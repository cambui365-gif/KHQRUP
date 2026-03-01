import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { db } from '../config/firebase.js';
import { COLLECTIONS, TransactionStatus, TransactionType, Currency } from '../config/constants.js';
import { UserProfile, SystemConfig, Transaction, WalletRecord } from '../types/index.js';
import { getAllWallets, refreshWalletBalance, consolidateWallet } from '../services/walletService.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

// ============ USERS ============

/**
 * GET /api/admin/users
 */
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection(COLLECTIONS.USERS).limit(200).get();
    const users = snapshot.docs.map(doc => {
      const data = doc.data() as UserProfile;
      const { pinHash, ...safe } = data;
      return { ...safe, hasPin: !!pinHash };
    });
    users.sort((a, b) => b.balance - a.balance);
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users/:id/adjust
 */
router.post('/users/:id/adjust', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { amount, description } = req.body;

    if (!amount || !description) {
      res.status(400).json({ success: false, error: 'amount and description required' });
      return;
    }

    const userRef = db.collection(COLLECTIONS.USERS).doc(userId.toString());
    const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('User not found');

      const user = userDoc.data() as UserProfile;
      const newBalance = user.balance + amount;
      if (newBalance < 0) throw new Error('Balance cannot be negative');

      transaction.update(userRef, { balance: newBalance, updatedAt: Date.now() });
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: TransactionType.ADJUSTMENT,
        amount: Math.abs(amount),
        currency: Currency.USDT,
        date: new Date().toLocaleString('en-US'),
        timestamp: Date.now(),
        status: TransactionStatus.COMPLETED,
        description,
        beforeBalance: user.balance,
        afterBalance: newBalance,
      });
    });

    res.json({ success: true, message: 'Balance adjusted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users/:id/block
 */
router.post('/users/:id/block', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const user = doc.data() as UserProfile;
    await userRef.update({ isBlocked: !user.isBlocked, updatedAt: Date.now() });
    res.json({ success: true, message: `User ${user.isBlocked ? 'unblocked' : 'blocked'}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users/:id/reset-pin
 */
router.post('/users/:id/reset-pin', async (req: Request, res: Response) => {
  try {
    await db.collection(COLLECTIONS.USERS).doc(req.params.id).update({
      pinHash: '',
      pinAttempts: 0,
      isLocked: false,
      updatedAt: Date.now(),
    });
    res.json({ success: true, message: 'PIN reset' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const batch = db.batch();

    batch.delete(db.collection(COLLECTIONS.USERS).doc(userId.toString()));

    // Delete related data
    const collections = [COLLECTIONS.TRANSACTIONS, COLLECTIONS.DEPOSIT_REQUESTS, COLLECTIONS.USER_SAVINGS];
    for (const col of collections) {
      const snap = await db.collection(col).where('userId', '==', userId).get();
      snap.docs.forEach(doc => batch.delete(doc.ref));
    }

    // Delete wallet
    const walletSnap = await db.collection(COLLECTIONS.WALLETS).where('userId', '==', userId).get();
    walletSnap.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    res.json({ success: true, message: 'User deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ TRANSACTIONS ============

/**
 * GET /api/admin/transactions
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const limitNum = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const snapshot = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .orderBy('timestamp', 'desc')
      .limit(limitNum)
      .get();
    res.json({ success: true, data: snapshot.docs.map(d => d.data()) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/transactions/:id/approve
 */
router.post('/transactions/:id/approve', async (req: Request, res: Response) => {
  try {
    const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(req.params.id);
    const doc = await txRef.get();
    if (!doc.exists) { res.status(404).json({ success: false, error: 'Not found' }); return; }

    const tx = doc.data() as Transaction;
    if (tx.status === TransactionStatus.COMPLETED || tx.status === TransactionStatus.REJECTED) {
      res.status(400).json({ success: false, error: 'Transaction already finalized' });
      return;
    }

    await txRef.update({ status: TransactionStatus.COMPLETED, partnerResponseCode: 'ADMIN_APPROVED' });
    res.json({ success: true, message: 'Transaction approved' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/transactions/:id/reject
 */
router.post('/transactions/:id/reject', async (req: Request, res: Response) => {
  try {
    const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(req.params.id);

    await db.runTransaction(async (transaction) => {
      const txDoc = await transaction.get(txRef);
      if (!txDoc.exists) throw new Error('Not found');

      const tx = txDoc.data() as Transaction;
      if (tx.status === TransactionStatus.COMPLETED) throw new Error('Already completed');

      // Refund
      const userRef = db.collection(COLLECTIONS.USERS).doc(tx.userId.toString());
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists) {
        transaction.update(userRef, { balance: (userDoc.data()?.balance || 0) + tx.amount });
      }
      transaction.update(txRef, {
        status: TransactionStatus.REJECTED,
        description: tx.description + ' (Rejected & refunded)',
      });
    });

    res.json({ success: true, message: 'Transaction rejected, balance refunded' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ WALLETS ============

/**
 * GET /api/admin/wallets
 */
router.get('/wallets', async (_req: Request, res: Response) => {
  try {
    const wallets = await getAllWallets();
    res.json({ success: true, data: wallets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/wallets/:address/refresh
 */
router.post('/wallets/:address/refresh', async (req: Request, res: Response) => {
  try {
    const balance = await refreshWalletBalance(req.params.address);
    res.json({ success: true, data: { address: req.params.address, balance } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/wallets/:address/consolidate
 */
router.post('/wallets/:address/consolidate', async (req: Request, res: Response) => {
  try {
    const configDoc = await db.collection(COLLECTIONS.CONFIG).doc('main').get();
    const config = configDoc.data() as SystemConfig;

    const result = await consolidateWallet(req.params.address, config.motherWalletAddress, req.body.amount);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: { txHash: result.txHash } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/wallets/consolidate-all
 */
router.post('/wallets/consolidate-all', async (_req: Request, res: Response) => {
  try {
    const configDoc = await db.collection(COLLECTIONS.CONFIG).doc('main').get();
    const config = configDoc.data() as SystemConfig;
    const wallets = await getAllWallets();

    const results: { address: string; success: boolean; txHash?: string; error?: string }[] = [];

    for (const wallet of wallets) {
      if (wallet.balanceOnChain >= config.consolidationThreshold) {
        const result = await consolidateWallet(wallet.address, config.motherWalletAddress, wallet.balanceOnChain);
        results.push({ address: wallet.address, ...result });
      }
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ CONFIG ============

/**
 * GET /api/admin/config
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const doc = await db.collection(COLLECTIONS.CONFIG).doc('main').get();
    res.json({ success: true, data: doc.data() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/config
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    await db.collection(COLLECTIONS.CONFIG).doc('main').update(req.body);
    res.json({ success: true, message: 'Config updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ DEPOSITS ============

/**
 * GET /api/admin/deposits
 */
router.get('/deposits', async (_req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.DEPOSIT_REQUESTS)
      .where('status', '==', 'PENDING')
      .orderBy('timestamp', 'desc')
      .get();
    res.json({ success: true, data: snapshot.docs.map(d => d.data()) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/deposits/:id/approve
 */
router.post('/deposits/:id/approve', async (req: Request, res: Response) => {
  try {
    const reqRef = db.collection(COLLECTIONS.DEPOSIT_REQUESTS).doc(req.params.id);
    const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();

    await db.runTransaction(async (transaction) => {
      const reqDoc = await transaction.get(reqRef);
      if (!reqDoc.exists) throw new Error('Request not found');

      const request = reqDoc.data()!;
      if (request.status !== 'PENDING') throw new Error('Already processed');

      const userRef = db.collection(COLLECTIONS.USERS).doc(request.userId.toString());
      const userDoc = await transaction.get(userRef);
      const newBalance = (userDoc.data()?.balance || 0) + request.amount;

      transaction.update(userRef, { balance: newBalance, updatedAt: Date.now() });
      transaction.update(reqRef, { status: 'APPROVED' });
      transaction.set(txRef, {
        id: txRef.id,
        userId: request.userId,
        type: TransactionType.DEPOSIT,
        amount: request.amount,
        currency: Currency.USDT,
        date: new Date().toLocaleString('en-US'),
        timestamp: Date.now(),
        status: TransactionStatus.COMPLETED,
        description: `Deposit approved: +${request.amount} USDT`,
      });
    });

    res.json({ success: true, message: 'Deposit approved' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/deposits/:id/reject
 */
router.post('/deposits/:id/reject', async (req: Request, res: Response) => {
  try {
    await db.collection(COLLECTIONS.DEPOSIT_REQUESTS).doc(req.params.id).update({ status: 'REJECTED' });
    res.json({ success: true, message: 'Deposit rejected' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ SAVINGS ============

/**
 * GET /api/admin/savings/plans
 */
router.get('/savings/plans', async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection(COLLECTIONS.SAVINGS_PLANS).get();
    res.json({ success: true, data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/savings/plans
 */
router.post('/savings/plans', async (req: Request, res: Response) => {
  try {
    const ref = await db.collection(COLLECTIONS.SAVINGS_PLANS).add(req.body);
    res.json({ success: true, data: { id: ref.id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/savings/plans/:id
 */
router.put('/savings/plans/:id', async (req: Request, res: Response) => {
  try {
    await db.collection(COLLECTIONS.SAVINGS_PLANS).doc(req.params.id).update(req.body);
    res.json({ success: true, message: 'Plan updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
