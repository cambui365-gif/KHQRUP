import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { db } from '../config/firebase.js';
import { COLLECTIONS, TransactionStatus, TransactionType, Currency } from '../config/constants.js';
import { UserProfile, SystemConfig, Transaction, WalletRecord } from '../types/index.js';
import { getAllWallets, refreshWalletBalance } from '../services/walletService.js';
import {
  getEnergyStatus, stakeForEnergy, unstakeEnergy,
  consolidateWithEnergy, batchConsolidate
} from '../services/energyService.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

// ============================================================
//  DASHBOARD (P0)
// ============================================================

/**
 * GET /api/admin/dashboard
 * Overview stats for the admin dashboard
 */
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    // Total user balances
    const usersSnap = await db.collection(COLLECTIONS.USERS).get();
    let totalSystemBalance = 0;
    let totalLockedBalance = 0;
    let activeUsers = 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    usersSnap.forEach(doc => {
      const u = doc.data();
      totalSystemBalance += u.balance || 0;
      totalLockedBalance += u.lockedBalance || 0;
      if (u.updatedAt > sevenDaysAgo) activeUsers++;
    });

    // Total on-chain balance across all child wallets
    const walletsSnap = await db.collection(COLLECTIONS.WALLETS).get();
    let totalOnChain = 0;
    let walletsWithBalance = 0;
    walletsSnap.forEach(doc => {
      const w = doc.data();
      totalOnChain += w.balanceOnChain || 0;
      if ((w.balanceOnChain || 0) > 0) walletsWithBalance++;
    });

    // Today's transactions
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const txSnap = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where('timestamp', '>=', todayStart.getTime())
      .get();
    let todayVolume = 0;
    let todayCount = 0;
    let todayFailed = 0;
    txSnap.forEach(doc => {
      const tx = doc.data();
      todayCount++;
      todayVolume += tx.amount || 0;
      if (tx.status === 'FAILED' || tx.status === 'REJECTED') todayFailed++;
    });

    // Pending approvals
    const pendingTxSnap = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where('status', '==', 'PENDING_APPROVAL')
      .get();
    const pendingDepSnap = await db.collection(COLLECTIONS.DEPOSIT_REQUESTS)
      .where('status', '==', 'PENDING')
      .get();

    // Energy status
    let energyStatus = null;
    try {
      energyStatus = await getEnergyStatus();
    } catch { }

    res.json({
      success: true,
      data: {
        balances: {
          totalSystemBalance,
          totalLockedBalance,
          totalOnChain,
          discrepancy: totalSystemBalance - totalOnChain,
        },
        users: {
          total: usersSnap.size,
          active7d: activeUsers,
        },
        wallets: {
          total: walletsSnap.size,
          withBalance: walletsWithBalance,
          totalOnChain,
        },
        today: {
          transactionCount: todayCount,
          volume: todayVolume,
          failedCount: todayFailed,
        },
        pending: {
          transactions: pendingTxSnap.size,
          deposits: pendingDepSnap.size,
          total: pendingTxSnap.size + pendingDepSnap.size,
        },
        energy: energyStatus,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/dashboard/chart
 * Transaction volume chart data (last 30 days)
 */
router.get('/dashboard/chart', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = Date.now() - days * 24 * 60 * 60 * 1000;

    const txSnap = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where('timestamp', '>=', startDate)
      .where('status', '==', 'COMPLETED')
      .orderBy('timestamp', 'asc')
      .get();

    // Group by date
    const dailyData: Record<string, { volume: number; count: number; deposits: number; payments: number }> = {};

    txSnap.forEach(doc => {
      const tx = doc.data();
      const date = new Date(tx.timestamp).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { volume: 0, count: 0, deposits: 0, payments: 0 };
      }
      dailyData[date].volume += tx.amount || 0;
      dailyData[date].count++;
      if (tx.type === 'DEPOSIT') dailyData[date].deposits += tx.amount || 0;
      if (tx.type === 'QR_PAYMENT') dailyData[date].payments += tx.amount || 0;
    });

    res.json({ success: true, data: dailyData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  USERS (P0)
// ============================================================

/**
 * GET /api/admin/users
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').toLowerCase();
    const status = req.query.status as string;
    const sortBy = req.query.sortBy as string || 'balance';
    const order = req.query.order as string || 'desc';
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    let q = db.collection(COLLECTIONS.USERS).limit(500); // Fetch more for filtering
    const snapshot = await q.get();

    let users = snapshot.docs.map(doc => {
      const data = doc.data() as UserProfile;
      const { pinHash, ...safe } = data;
      return { ...safe, hasPin: !!pinHash };
    });

    // Filter
    if (search) {
      users = users.filter(u =>
        u.id.toString().includes(search) ||
        (u.username || '').toLowerCase().includes(search) ||
        (u.firstName || '').toLowerCase().includes(search) ||
        (u.walletAddress || '').toLowerCase().includes(search)
      );
    }
    if (status === 'blocked') users = users.filter(u => u.isBlocked);
    if (status === 'locked') users = users.filter(u => u.isLocked);
    if (status === 'active') users = users.filter(u => !u.isBlocked && !u.isLocked);

    // Sort
    users.sort((a: any, b: any) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Paginate
    const total = users.length;
    const start = (page - 1) * limit;
    const paginated = users.slice(start, start + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/users/:id
 * Detailed user info including wallet & transaction summary
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const userData = userDoc.data() as UserProfile;
    const { pinHash, ...safeUser } = userData;

    // Get wallet info
    const walletSnap = await db.collection(COLLECTIONS.WALLETS)
      .where('userId', '==', parseInt(userId))
      .limit(1)
      .get();
    const wallet = walletSnap.empty ? null : walletSnap.docs[0].data();

    // Get transaction summary
    const txSnap = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where('userId', '==', parseInt(userId))
      .get();

    let totalDeposits = 0;
    let totalPayments = 0;
    let totalInterest = 0;
    let txCount = 0;
    txSnap.forEach(doc => {
      const tx = doc.data();
      txCount++;
      if (tx.status === 'COMPLETED') {
        if (tx.type === 'DEPOSIT') totalDeposits += tx.amount;
        if (tx.type === 'QR_PAYMENT') totalPayments += tx.amount;
        if (tx.type === 'INTEREST') totalInterest += tx.amount;
      }
    });

    // Get active savings
    const savingsSnap = await db.collection(COLLECTIONS.USER_SAVINGS)
      .where('userId', '==', parseInt(userId))
      .where('status', '==', 'ACTIVE')
      .get();
    const activeSavings = savingsSnap.docs.map(d => d.data());

    res.json({
      success: true,
      data: {
        user: { ...safeUser, hasPin: !!pinHash },
        wallet,
        summary: { totalDeposits, totalPayments, totalInterest, txCount },
        activeSavings,
      },
    });
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

    if (amount === undefined || !description) {
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
        description: `[Admin] ${description}`,
        beforeBalance: user.balance,
        afterBalance: newBalance,
      });
    });

    // Audit log
    await logAdminAction(req.user!.userId, 'ADJUST_BALANCE', { userId, amount, description });

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
    const newStatus = !user.isBlocked;
    await userRef.update({ isBlocked: newStatus, updatedAt: Date.now() });

    await logAdminAction(req.user!.userId, newStatus ? 'BLOCK_USER' : 'UNBLOCK_USER', { userId });

    res.json({ success: true, message: `User ${newStatus ? 'blocked' : 'unblocked'}` });
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
      pinHash: '', pinAttempts: 0, isLocked: false, updatedAt: Date.now(),
    });
    await logAdminAction(req.user!.userId, 'RESET_PIN', { userId: req.params.id });
    res.json({ success: true, message: 'PIN reset' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users/:id/set-limit
 */
router.post('/users/:id/set-limit', async (req: Request, res: Response) => {
  try {
    const { autoApprovalLimit, dailyWithdrawLimit } = req.body;
    const updates: any = { updatedAt: Date.now() };
    if (autoApprovalLimit !== undefined) updates.autoApprovalLimit = autoApprovalLimit;
    if (dailyWithdrawLimit !== undefined) updates.dailyWithdrawLimit = dailyWithdrawLimit;

    await db.collection(COLLECTIONS.USERS).doc(req.params.id).update(updates);
    await logAdminAction(req.user!.userId, 'SET_USER_LIMIT', { userId: req.params.id, ...updates });
    res.json({ success: true, message: 'Limits updated' });
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

    const collections = [COLLECTIONS.TRANSACTIONS, COLLECTIONS.DEPOSIT_REQUESTS, COLLECTIONS.USER_SAVINGS];
    for (const col of collections) {
      const snap = await db.collection(col).where('userId', '==', userId).get();
      snap.docs.forEach(doc => batch.delete(doc.ref));
    }

    const walletSnap = await db.collection(COLLECTIONS.WALLETS).where('userId', '==', userId).get();
    walletSnap.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    await logAdminAction(req.user!.userId, 'DELETE_USER', { userId });
    res.json({ success: true, message: 'User deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  TRANSACTIONS (P0)
// ============================================================

/**
 * GET /api/admin/transactions
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const type = req.query.type as string;
    const userId = req.query.userId as string;
    const from = req.query.from as string;
    const to = req.query.to as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    let query: any = db.collection(COLLECTIONS.TRANSACTIONS);

    if (status) query = query.where('status', '==', status);
    if (type) query = query.where('type', '==', type);
    if (userId) query = query.where('userId', '==', parseInt(userId));
    if (from) query = query.where('timestamp', '>=', new Date(from).getTime());
    if (to) query = query.where('timestamp', '<=', new Date(to).getTime());

    query = query.orderBy('timestamp', 'desc').limit(limit * page);

    const snapshot = await query.get();
    const allTxs = snapshot.docs.map((d: any) => d.data());
    const paginated = allTxs.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: paginated,
      pagination: { total: allTxs.length, page, limit },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/transactions/pending
 * Separate endpoint for pending queue
 */
router.get('/transactions/pending', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where('status', 'in', ['PENDING_APPROVAL', 'PROCESSING'])
      .orderBy('timestamp', 'asc')
      .get();
    res.json({ success: true, data: snap.docs.map(d => d.data()) });
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
    if (['COMPLETED', 'REJECTED', 'FAILED'].includes(tx.status)) {
      res.status(400).json({ success: false, error: 'Transaction already finalized' });
      return;
    }

    await txRef.update({ status: TransactionStatus.COMPLETED, partnerResponseCode: 'ADMIN_APPROVED' });
    await logAdminAction(req.user!.userId, 'APPROVE_TX', { txId: req.params.id });
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
    const { reason } = req.body;

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
        description: tx.description + ` [Rejected: ${reason || 'No reason'}]`,
      });
    });

    await logAdminAction(req.user!.userId, 'REJECT_TX', { txId: req.params.id, reason });
    res.json({ success: true, message: 'Transaction rejected, balance refunded' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  WALLETS & ENERGY (P0)
// ============================================================

/**
 * GET /api/admin/wallets
 */
router.get('/wallets', async (req: Request, res: Response) => {
  try {
    const onlyWithBalance = req.query.withBalance === 'true';
    let wallets = await getAllWallets();

    if (onlyWithBalance) {
      wallets = wallets.filter(w => (w.balanceOnChain || 0) > 0);
    }

    // Join with user data for display
    const userIds = [...new Set(wallets.map(w => w.userId))];
    const userMap: Record<number, string> = {};
    for (const uid of userIds) {
      const uDoc = await db.collection(COLLECTIONS.USERS).doc(uid.toString()).get();
      if (uDoc.exists) {
        const u = uDoc.data()!;
        userMap[uid] = u.firstName || u.username || uid.toString();
      }
    }

    const enriched = wallets.map(w => ({
      ...w,
      userName: userMap[w.userId] || 'Unknown',
    }));

    res.json({ success: true, data: enriched });
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
 * POST /api/admin/wallets/refresh-all
 */
router.post('/wallets/refresh-all', async (_req: Request, res: Response) => {
  try {
    const wallets = await getAllWallets();
    const results: Array<{ address: string; balance: number }> = [];

    for (const w of wallets) {
      try {
        const balance = await refreshWalletBalance(w.address);
        results.push({ address: w.address, balance });
      } catch { }
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/wallets/:address/consolidate
 * Consolidate single wallet using energy delegation
 */
router.post('/wallets/:address/consolidate', async (req: Request, res: Response) => {
  try {
    const configDoc = await db.collection(COLLECTIONS.CONFIG).doc('main').get();
    const config = configDoc.data() as SystemConfig;
    const amount = req.body.amount;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Invalid amount' });
      return;
    }

    const result = await consolidateWithEnergy(req.params.address, amount, config.motherWalletAddress);
    await logAdminAction(req.user!.userId, 'CONSOLIDATE_WALLET', {
      address: req.params.address, amount, ...result,
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error, steps: result.steps });
      return;
    }

    res.json({ success: true, data: { txHash: result.txHash, steps: result.steps } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/wallets/consolidate-all
 * Batch consolidate all wallets above threshold
 */
router.post('/wallets/consolidate-all', async (req: Request, res: Response) => {
  try {
    const configDoc = await db.collection(COLLECTIONS.CONFIG).doc('main').get();
    const config = configDoc.data() as SystemConfig;
    const threshold = req.body.threshold || config.consolidationThreshold || 5;

    const wallets = await getAllWallets();
    const eligible = wallets
      .filter(w => (w.balanceOnChain || 0) >= threshold)
      .map(w => ({ address: w.address, amount: w.balanceOnChain }));

    if (eligible.length === 0) {
      res.json({ success: true, data: { message: 'No wallets to consolidate', results: [] } });
      return;
    }

    const { results, totalConsolidated } = await batchConsolidate(
      eligible,
      config.motherWalletAddress
    );

    await logAdminAction(req.user!.userId, 'BATCH_CONSOLIDATE', {
      walletsProcessed: eligible.length, totalConsolidated,
    });

    res.json({ success: true, data: { results, totalConsolidated } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/energy
 * Energy/resource status of mother wallet
 */
router.get('/energy', async (_req: Request, res: Response) => {
  try {
    const status = await getEnergyStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/energy/stake
 */
router.post('/energy/stake', async (req: Request, res: Response) => {
  try {
    const { amountTRX } = req.body;
    if (!amountTRX || amountTRX <= 0) {
      res.status(400).json({ success: false, error: 'Invalid amount' });
      return;
    }

    const result = await stakeForEnergy(amountTRX);
    await logAdminAction(req.user!.userId, 'STAKE_ENERGY', { amountTRX, ...result });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/energy/unstake
 */
router.post('/energy/unstake', async (req: Request, res: Response) => {
  try {
    const { amountTRX } = req.body;
    const result = await unstakeEnergy(amountTRX);
    await logAdminAction(req.user!.userId, 'UNSTAKE_ENERGY', { amountTRX, ...result });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/energy/logs
 */
router.get('/energy/logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const snap = await db.collection('energy_logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    res.json({ success: true, data: snap.docs.map(d => d.data()) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  DEPOSITS (P0)
// ============================================================

/**
 * GET /api/admin/deposits
 */
router.get('/deposits', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string || 'PENDING';
    const snap = await db.collection(COLLECTIONS.DEPOSIT_REQUESTS)
      .where('status', '==', status)
      .orderBy('timestamp', 'desc')
      .get();
    res.json({ success: true, data: snap.docs.map(d => d.data()) });
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

    await logAdminAction(req.user!.userId, 'APPROVE_DEPOSIT', { depositId: req.params.id });
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
    await logAdminAction(req.user!.userId, 'REJECT_DEPOSIT', { depositId: req.params.id });
    res.json({ success: true, message: 'Deposit rejected' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  CONFIG (P0)
// ============================================================

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
    const before = (await db.collection(COLLECTIONS.CONFIG).doc('main').get()).data();
    await db.collection(COLLECTIONS.CONFIG).doc('main').update(req.body);
    await logAdminAction(req.user!.userId, 'UPDATE_CONFIG', { changes: req.body });
    res.json({ success: true, message: 'Config updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  SAVINGS (P0)
// ============================================================

router.get('/savings/plans', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection(COLLECTIONS.SAVINGS_PLANS).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/savings/plans', async (req: Request, res: Response) => {
  try {
    const ref = await db.collection(COLLECTIONS.SAVINGS_PLANS).add(req.body);
    await logAdminAction(req.user!.userId, 'CREATE_SAVINGS_PLAN', { planId: ref.id });
    res.json({ success: true, data: { id: ref.id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/savings/plans/:id', async (req: Request, res: Response) => {
  try {
    await db.collection(COLLECTIONS.SAVINGS_PLANS).doc(req.params.id).update(req.body);
    await logAdminAction(req.user!.userId, 'UPDATE_SAVINGS_PLAN', { planId: req.params.id });
    res.json({ success: true, message: 'Plan updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  AUDIT LOG (P1 - prepared)
// ============================================================

/**
 * GET /api/admin/audit-logs
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const snap = await db.collection('audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    res.json({ success: true, data: snap.docs.map(d => d.data()) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  RECONCILIATION (P1 - prepared)
// ============================================================

/**
 * GET /api/admin/reconciliation
 * Compare system balances vs on-chain balances
 */
router.get('/reconciliation', async (_req: Request, res: Response) => {
  try {
    const usersSnap = await db.collection(COLLECTIONS.USERS).get();
    const walletsSnap = await db.collection(COLLECTIONS.WALLETS).get();

    let totalSystemBalance = 0;
    let totalLockedBalance = 0;
    usersSnap.forEach(doc => {
      const u = doc.data();
      totalSystemBalance += u.balance || 0;
      totalLockedBalance += u.lockedBalance || 0;
    });

    let totalOnChainChildWallets = 0;
    const walletsNeedingConsolidation: any[] = [];
    walletsSnap.forEach(doc => {
      const w = doc.data();
      totalOnChainChildWallets += w.balanceOnChain || 0;
      if ((w.balanceOnChain || 0) > 0 && !w.isConsolidated) {
        walletsNeedingConsolidation.push({
          address: w.address,
          userId: w.userId,
          balance: w.balanceOnChain,
          lastChecked: w.lastChecked,
        });
      }
    });

    // Get total deposits vs total withdrawals
    const txSnap = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where('status', '==', 'COMPLETED')
      .get();

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalInterestPaid = 0;
    txSnap.forEach(doc => {
      const tx = doc.data();
      if (tx.type === 'DEPOSIT') totalDeposits += tx.amount;
      if (tx.type === 'QR_PAYMENT') totalWithdrawals += tx.amount;
      if (tx.type === 'INTEREST') totalInterestPaid += tx.amount;
    });

    res.json({
      success: true,
      data: {
        systemBalance: totalSystemBalance,
        lockedBalance: totalLockedBalance,
        onChainChildWallets: totalOnChainChildWallets,
        discrepancy: totalSystemBalance - totalOnChainChildWallets,
        flowSummary: {
          totalDeposits,
          totalWithdrawals,
          totalInterestPaid,
          netFlow: totalDeposits - totalWithdrawals - totalInterestPaid,
        },
        walletsNeedingConsolidation,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  REPORTS (P2 - prepared)
// ============================================================

/**
 * GET /api/admin/reports/daily
 */
router.get('/reports/daily', async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const dayStart = new Date(date).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const txSnap = await db.collection(COLLECTIONS.TRANSACTIONS)
      .where('timestamp', '>=', dayStart)
      .where('timestamp', '<', dayEnd)
      .get();

    const report = {
      date,
      totalTransactions: 0,
      totalVolume: 0,
      deposits: { count: 0, volume: 0 },
      payments: { count: 0, volume: 0 },
      interest: { count: 0, volume: 0 },
      adjustments: { count: 0, volume: 0 },
      failed: { count: 0, volume: 0 },
      byStatus: {} as Record<string, number>,
      byQrType: {} as Record<string, number>,
    };

    txSnap.forEach(doc => {
      const tx = doc.data();
      report.totalTransactions++;
      report.totalVolume += tx.amount || 0;

      // By type
      if (tx.type === 'DEPOSIT') { report.deposits.count++; report.deposits.volume += tx.amount; }
      if (tx.type === 'QR_PAYMENT') { report.payments.count++; report.payments.volume += tx.amount; }
      if (tx.type === 'INTEREST') { report.interest.count++; report.interest.volume += tx.amount; }
      if (tx.type === 'ADJUSTMENT') { report.adjustments.count++; report.adjustments.volume += tx.amount; }
      if (tx.status === 'FAILED' || tx.status === 'REJECTED') { report.failed.count++; report.failed.volume += tx.amount; }

      // By status
      report.byStatus[tx.status] = (report.byStatus[tx.status] || 0) + 1;

      // By QR type
      if (tx.qrType) {
        report.byQrType[tx.qrType] = (report.byQrType[tx.qrType] || 0) + 1;
      }
    });

    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/reports/export
 * Export transactions as CSV
 */
router.get('/reports/export', async (req: Request, res: Response) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;

    let query: any = db.collection(COLLECTIONS.TRANSACTIONS);
    if (from) query = query.where('timestamp', '>=', new Date(from).getTime());
    if (to) query = query.where('timestamp', '<=', new Date(to).getTime());
    query = query.orderBy('timestamp', 'desc').limit(5000);

    const snap = await query.get();
    const txs = snap.docs.map((d: any) => d.data());

    // CSV header
    const headers = ['ID', 'Date', 'User ID', 'Type', 'Amount (USDT)', 'Original Amount', 'Original Currency', 'Status', 'Description', 'Merchant', 'Bank', 'QR Type'];
    const rows = txs.map((tx: any) => [
      tx.id, tx.date, tx.userId, tx.type, tx.amount,
      tx.originalAmount || '', tx.originalCurrency || '',
      tx.status, `"${(tx.description || '').replace(/"/g, '""')}"`,
      tx.merchantName || '', tx.bankName || '', tx.qrType || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transactions_${from || 'all'}_${to || 'now'}.csv`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
//  HELPERS
// ============================================================

/**
 * Append-only audit log
 */
async function logAdminAction(adminId: number, action: string, details: any) {
  try {
    await db.collection('audit_logs').add({
      adminId,
      action,
      details,
      timestamp: Date.now(),
      date: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export default router;
