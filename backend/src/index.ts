import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';

const DEMO_MODE = process.env.DEMO_MODE === 'true' || !process.env.FIREBASE_PROJECT_ID;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', demo: DEMO_MODE, timestamp: Date.now() });
});

// Mock payment endpoint
app.post('/api/mock/payment', async (req, res) => {
  console.log('[MockPayment] Received:', JSON.stringify(req.body).slice(0, 200));
  await new Promise(r => setTimeout(r, 10_000));
  res.json({ success: true, transactionId: `MOCK_${Date.now()}`, code: '00', message: 'Success' });
});

// Demo routes
if (DEMO_MODE) {
  const { simulateDeposit } = await import('./services/walletService.js');
  const { authMiddleware, adminMiddleware } = await import('./middleware/auth.js');

  // Simulate on-chain deposit to a child wallet
  app.post('/api/demo/deposit', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { address, amount } = req.body;
      if (!address || !amount) {
        res.status(400).json({ success: false, error: 'address and amount required' });
        return;
      }
      await simulateDeposit(address, amount);
      res.json({ success: true, message: `Simulated ${amount} USDT deposit to ${address}` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Simulate auto-credit (as if TRON listener detected deposit)
  app.post('/api/demo/auto-credit', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { userId, amount } = req.body;
      const { db } = await import('./config/firebase.js');
      const { COLLECTIONS, TransactionStatus, TransactionType, Currency } = await import('./config/constants.js');

      const userRef = db.collection(COLLECTIONS.USERS).doc(userId.toString());
      const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(`demo_dep_${Date.now()}`);

      await db.runTransaction(async (transaction: any) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error('User not found');
        const userData = userDoc.data();
        const newBalance = (userData.balance || 0) + amount;

        transaction.update(userRef, { balance: newBalance, updatedAt: Date.now() });
        transaction.set(txRef, {
          id: txRef.id,
          userId: parseInt(userId),
          type: TransactionType.DEPOSIT,
          amount,
          currency: Currency.USDT,
          date: new Date().toLocaleString('en-US'),
          timestamp: Date.now(),
          status: TransactionStatus.COMPLETED,
          description: `[Demo] Auto deposit ${amount} USDT`,
          beforeBalance: userData.balance || 0,
          afterBalance: newBalance,
        });
      });

      res.json({ success: true, message: `Credited ${amount} USDT to user ${userId}` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('🧪 Demo routes enabled: POST /api/demo/deposit, /api/demo/auto-credit');
}

// Serve frontend static files in production
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(frontendDist, 'index.html'));
  });
  console.log('📂 Serving frontend from', frontendDist);
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 KHQRUP Backend running on port ${PORT}`);
  console.log(`   Mode: ${DEMO_MODE ? '🧪 DEMO' : '🟢 PRODUCTION'}`);
  if (DEMO_MODE) {
    console.log(`   Admin login: admin / demo123`);
    console.log(`   Admin Telegram IDs: ${process.env.ADMIN_TELEGRAM_IDS || 'none'}`);
  }
});

export default app;
