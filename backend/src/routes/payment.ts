import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../config/firebase.js';
import { COLLECTIONS, TransactionStatus, TransactionType, Currency, QRType } from '../config/constants.js';
import { verifyPin } from '../services/userService.js';
import { sendToPartner } from '../services/paymentService.js';
import { parseQRCode, mapCurrencyCode } from '../utils/qrParser.js';
import { UserProfile, SystemConfig, Transaction, PartnerPaymentRequest } from '../types/index.js';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/payment/qr
 * Process QR payment (KHQR or VietQR)
 */
router.post('/qr', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { rawQrData, amount, currency, pin, note } = req.body;

    if (!rawQrData || !amount || !currency || !pin) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // 1. Verify PIN
    const pinResult = await verifyPin(userId, pin);
    if (!pinResult.valid) {
      res.status(403).json({
        success: false,
        error: pinResult.error,
        isLocked: pinResult.isLocked,
        remainingAttempts: pinResult.remainingAttempts,
      });
      return;
    }

    // 2. Parse QR code
    const qrData = parseQRCode(rawQrData);

    // 3. Get user & config
    const [userDoc, configDoc] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(userId.toString()).get(),
      db.collection(COLLECTIONS.CONFIG).doc('main').get(),
    ]);

    const user = userDoc.data() as UserProfile;
    const config = configDoc.data() as SystemConfig;

    // 4. Check system status
    if (config.maintenanceMode) {
      res.status(503).json({ success: false, error: 'System maintenance' });
      return;
    }
    if (!config.globalWithdrawEnable) {
      res.status(503).json({ success: false, error: 'Withdrawals disabled' });
      return;
    }
    if (user.isBlocked || user.isLocked) {
      res.status(403).json({ success: false, error: 'Account restricted' });
      return;
    }

    // 5. Calculate USDT amount
    const rate = config.exchangeRates[currency as Currency] || 1;
    const amountUSDT = amount / rate;

    if (user.balance < amountUSDT) {
      res.status(400).json({ success: false, error: 'Insufficient balance' });
      return;
    }

    // 6. Create transaction
    const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
    const newTx: Transaction = {
      id: txRef.id,
      userId,
      type: TransactionType.QR_PAYMENT,
      amount: amountUSDT,
      currency: Currency.USDT,
      originalAmount: amount,
      originalCurrency: currency as Currency,
      date: new Date().toLocaleString('en-US'),
      timestamp: Date.now(),
      status: TransactionStatus.PROCESSING,
      description: note || `QR Payment to ${qrData.merchantName}`,
      merchantName: qrData.merchantName,
      bankName: qrData.bankCode,
      merchantCity: qrData.merchantCity,
      recipientAccount: qrData.accountNumber,
      rawQrData,
      qrType: qrData.type,
      approvalType: 'AUTO',
      beforeBalance: user.balance,
      afterBalance: user.balance - amountUSDT,
    };

    // 7. Deduct balance & save transaction
    await db.runTransaction(async (transaction) => {
      const freshUser = await transaction.get(db.collection(COLLECTIONS.USERS).doc(userId.toString()));
      const currentBalance = freshUser.data()?.balance || 0;
      if (currentBalance < amountUSDT) throw new Error('Insufficient balance');

      transaction.update(db.collection(COLLECTIONS.USERS).doc(userId.toString()), {
        balance: currentBalance - amountUSDT,
        updatedAt: Date.now(),
      });
      transaction.set(txRef, newTx);
    });

    // 8. Send to partner API (async - don't block response)
    processPartnerPayment(txRef.id, qrData, newTx).catch(err => {
      console.error(`[Payment] Partner processing failed for ${txRef.id}:`, err);
    });

    res.json({
      success: true,
      data: {
        transactionId: txRef.id,
        status: 'PROCESSING',
        message: 'Payment is being processed',
      },
    });
  } catch (error: any) {
    console.error('Payment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payment/status/:txId
 */
router.get('/status/:txId', async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;
    const doc = await db.collection(COLLECTIONS.TRANSACTIONS).doc(txId).get();

    if (!doc.exists) {
      res.status(404).json({ success: false, error: 'Transaction not found' });
      return;
    }

    const tx = doc.data() as Transaction;
    // Only allow owner to check
    if (tx.userId !== req.user!.userId && !req.user!.isAdmin) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: tx });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payment/parse-qr
 * Parse QR code without making payment (preview)
 */
router.post('/parse-qr', async (req: Request, res: Response) => {
  try {
    const { rawQrData } = req.body;
    if (!rawQrData) {
      res.status(400).json({ success: false, error: 'rawQrData required' });
      return;
    }

    const parsed = parseQRCode(rawQrData);
    const currencyName = mapCurrencyCode(parsed.currency);

    res.json({
      success: true,
      data: {
        ...parsed,
        currencyName,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Process payment via partner API (background)
 */
async function processPartnerPayment(txId: string, qrData: ReturnType<typeof parseQRCode>, tx: Transaction) {
  const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(txId);

  try {
    const partnerRequest: PartnerPaymentRequest = {
      transactionId: txId,
      qrType: qrData.type,
      bankCode: qrData.bankCode,
      accountNumber: qrData.accountNumber,
      amount: tx.originalAmount || tx.amount,
      currency: (tx.originalCurrency || tx.currency) as Currency,
      merchantName: qrData.merchantName,
      rawQrData: tx.rawQrData || '',
    };

    const result = await sendToPartner(partnerRequest);

    if (result.success) {
      await txRef.update({
        status: TransactionStatus.COMPLETED,
        partnerTxId: result.partnerTxId,
        partnerResponseCode: result.responseCode,
        description: tx.description + ' ✓',
      });
    } else {
      // Refund on failure
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection(COLLECTIONS.USERS).doc(tx.userId.toString());
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
          const currentBalance = userDoc.data()?.balance || 0;
          transaction.update(userRef, { balance: currentBalance + tx.amount });
        }
        transaction.update(txRef, {
          status: TransactionStatus.FAILED,
          partnerResponseCode: result.responseCode,
          description: tx.description + ` [FAILED: ${result.message}]`,
        });
      });
    }
  } catch (error: any) {
    // Refund on error
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection(COLLECTIONS.USERS).doc(tx.userId.toString());
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists) {
        const currentBalance = userDoc.data()?.balance || 0;
        transaction.update(userRef, { balance: currentBalance + tx.amount });
      }
      transaction.update(txRef, {
        status: TransactionStatus.FAILED,
        description: tx.description + ` [ERROR: ${error.message}]`,
      });
    });
  }
}

export default router;
