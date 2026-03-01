import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';
import { setUserPin, claimDailyInterest, hashPin } from '../services/userService.js';
import { getWalletByUserId } from '../services/walletService.js';
import { UserProfile, SystemConfig } from '../types/index.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/user/profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const doc = await db.collection(COLLECTIONS.USERS).doc(userId.toString()).get();

    if (!doc.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const user = doc.data() as UserProfile;
    // Never send pinHash to client
    const { pinHash, ...safeUser } = user;

    res.json({ success: true, data: { ...safeUser, hasPin: !!pinHash } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/wallet
 */
router.get('/wallet', async (req: Request, res: Response) => {
  try {
    const wallet = await getWalletByUserId(req.user!.userId);
    if (!wallet) {
      res.status(404).json({ success: false, error: 'Wallet not found' });
      return;
    }
    res.json({ success: true, data: wallet });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/pin
 */
router.post('/pin', async (req: Request, res: Response) => {
  try {
    const { pin, currentPin } = req.body;
    if (!pin || pin.length < 4 || pin.length > 6) {
      res.status(400).json({ success: false, error: 'PIN must be 4-6 digits' });
      return;
    }

    const userId = req.user!.userId;
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId.toString()).get();
    const user = userDoc.data() as UserProfile;

    // If PIN already set, require current PIN
    if (user.pinHash && currentPin) {
      const currentHash = hashPin(currentPin);
      if (currentHash !== user.pinHash) {
        res.status(403).json({ success: false, error: 'Current PIN incorrect' });
        return;
      }
    }

    await setUserPin(userId, pin);
    res.json({ success: true, message: 'PIN set successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/transactions
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limitNum = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const snapshot = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limitNum)
      .get();

    const transactions = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, data: transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/interest/claim
 */
router.post('/interest/claim', async (req: Request, res: Response) => {
  try {
    const configDoc = await db.collection(COLLECTIONS.CONFIG).doc('main').get();
    const config = configDoc.data() as SystemConfig;

    const result = await claimDailyInterest(req.user!.userId, config.interestConfig);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/config
 * Public system config (rates, maintenance, etc.)
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const doc = await db.collection(COLLECTIONS.CONFIG).doc('main').get();
    if (!doc.exists) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }

    const config = doc.data() as SystemConfig;
    // Strip sensitive fields
    const { telegramBotToken, telegramAdminChatId, ...safeConfig } = config;
    res.json({ success: true, data: safeConfig });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
