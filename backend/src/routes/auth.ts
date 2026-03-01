import { Router, Request, Response } from 'express';
import { validateTelegramInitData, generateToken } from '../middleware/auth.js';
import { getOrCreateUser } from '../services/userService.js';

const router = Router();

// Admin credentials (move to env in production)
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(Number).filter(Boolean);

/**
 * POST /api/auth/telegram
 * Validate Telegram initData and return JWT
 */
router.post('/telegram', async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      res.status(400).json({ success: false, error: 'initData required' });
      return;
    }

    // Validate Telegram signature
    const isValid = validateTelegramInitData(initData);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid Telegram data' });
      return;
    }

    // Extract user from initData
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) {
      res.status(400).json({ success: false, error: 'No user in initData' });
      return;
    }

    const telegramUser = JSON.parse(decodeURIComponent(userStr));

    // Get or create user in DB
    const user = await getOrCreateUser(telegramUser);

    // Check if admin
    const isAdmin = ADMIN_IDS.includes(user.id);

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      username: user.username,
      isAdmin,
    });

    res.json({
      success: true,
      data: {
        token,
        user,
        isAdmin,
      },
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/admin
 * Admin login (for web dashboard, not Telegram)
 */
router.post('/admin', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || '';

    if (!adminPass) {
      res.status(503).json({ success: false, error: 'Admin login not configured' });
      return;
    }

    if (username !== adminUser || password !== adminPass) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: 0,
      username: 'admin',
      isAdmin: true,
    });

    res.json({ success: true, data: { token, isAdmin: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
