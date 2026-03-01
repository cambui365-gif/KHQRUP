import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import { startTronListener } from './services/tronListener.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Mock payment endpoint (for development)
app.post('/api/mock/payment', async (req, res) => {
  console.log('[MockEndpoint] Received payment request:', req.body);
  await new Promise(r => setTimeout(r, 10_000));
  res.json({ success: true, transactionId: `MOCK_${Date.now()}`, code: '00', message: 'Success' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 KHQRUP Backend running on port ${PORT}`);

  // Start TRON deposit listener
  if (process.env.TRON_MASTER_MNEMONIC) {
    startTronListener();
  } else {
    console.log('⚠️  TRON_MASTER_MNEMONIC not set - deposit listener disabled');
  }
});

export default app;
