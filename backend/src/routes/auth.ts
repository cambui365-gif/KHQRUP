import { Router, Request, Response } from 'express';
import { validateTelegramInitData, generateToken } from '../middleware/auth.js';
import { getOrCreateUser } from '../services/userService.js';

const router = Router();

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(Number).filter(Boolean);

/**
 * POST /api/auth/telegram
 */
router.post('/telegram', async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      res.status(400).json({ success: false, error: 'initData required' });
      return;
    }

    // In demo mode, be lenient with validation
    let telegramUser: any = null;

    if (DEMO_MODE) {
      // Try to parse user from initData even without valid hash
      try {
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (userStr) {
          telegramUser = JSON.parse(decodeURIComponent(userStr));
        }
      } catch {}

      // If can't parse, also try validation
      if (!telegramUser) {
        const isValid = validateTelegramInitData(initData);
        if (isValid) {
          const params = new URLSearchParams(initData);
          const userStr = params.get('user');
          if (userStr) telegramUser = JSON.parse(decodeURIComponent(userStr));
        }
      }
    } else {
      // Production: strict validation
      const isValid = validateTelegramInitData(initData);
      if (!isValid) {
        res.status(401).json({ success: false, error: 'Invalid Telegram data' });
        return;
      }
      const params = new URLSearchParams(initData);
      const userStr = params.get('user');
      if (userStr) telegramUser = JSON.parse(decodeURIComponent(userStr));
    }

    if (!telegramUser) {
      res.status(400).json({ success: false, error: 'No user data found' });
      return;
    }

    const user = await getOrCreateUser(telegramUser);
    const isAdmin = ADMIN_IDS.includes(user.id);

    const token = generateToken({ userId: user.id, username: user.username, isAdmin });

    res.json({
      success: true,
      data: { token, user, isAdmin },
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/admin
 */
router.post('/admin', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || (DEMO_MODE ? 'demo123' : '');

    if (!adminPass) {
      res.status(503).json({ success: false, error: 'Admin login not configured' });
      return;
    }

    if (username !== adminUser || password !== adminPass) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({ userId: 0, username: 'admin', isAdmin: true });
    res.json({ success: true, data: { token, isAdmin: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
