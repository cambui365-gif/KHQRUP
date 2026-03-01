# KHQRUP — USDT & QR Payment Wallet

Commercial-grade Telegram Mini App wallet supporting **USDT-TRC20** deposits with **KHQR** (Cambodia) and **VietQR** (Vietnam) payment integration.

## Architecture

```
Frontend (React + Vite)  ←→  Backend (Express + TypeScript)  ←→  Firebase Firestore
                                      ↕                              ↕
                              Partner Payment API            TRON Blockchain (HD Wallets)
```

### Key Features

- 🔐 **Secure Auth** — Telegram initData server-side validation + JWT
- 💰 **HD Wallets** — Each user gets a unique TRON child wallet (derived from master mnemonic)
- 📡 **Auto Deposits** — TRON listener detects USDT deposits and auto-credits balance
- 📷 **QR Payments** — Scan KHQR & VietQR, parsed server-side via EMV QR standard
- 🔄 **Partner API** — Payment routing to partner API (mock included, plug real API later)
- 📈 **Earn Interest** — Tiered APY on USDT balance
- 🏦 **Wallet Management** — Admin can view all child wallets, refresh balances, consolidate to mother wallet
- 🛡️ **PIN Security** — SHA-256 hashed, server-side verification, auto-lock after 5 attempts

## Setup

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for JWT signing |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `TRON_MASTER_MNEMONIC` | 24-word mnemonic for HD wallet derivation |
| `TRON_API_KEY` | TronGrid API key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `ADMIN_TELEGRAM_IDS` | Comma-separated admin Telegram user IDs |
| `PARTNER_PAYMENT_URL` | Partner payment API endpoint |

## API Endpoints

### Auth
- `POST /api/auth/telegram` — Telegram WebApp login
- `POST /api/auth/admin` — Admin web login

### User
- `GET /api/user/profile` — Get user profile
- `GET /api/user/wallet` — Get deposit wallet address
- `POST /api/user/pin` — Set/change PIN
- `GET /api/user/transactions` — Transaction history
- `POST /api/user/interest/claim` — Claim daily interest

### Payment
- `POST /api/payment/qr` — Process QR payment
- `POST /api/payment/parse-qr` — Parse QR code (preview)
- `GET /api/payment/status/:txId` — Check payment status

### Admin
- `GET /api/admin/users` — List all users
- `POST /api/admin/users/:id/adjust` — Adjust balance
- `POST /api/admin/users/:id/block` — Block/unblock user
- `GET /api/admin/wallets` — List all child wallets
- `POST /api/admin/wallets/:address/refresh` — Refresh on-chain balance
- `POST /api/admin/wallets/:address/consolidate` — Sweep to mother wallet
- `POST /api/admin/wallets/consolidate-all` — Sweep all wallets above threshold
- Full CRUD for config, deposits, savings plans

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Firebase Admin SDK, TronWeb
- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Database:** Firebase Firestore
- **Blockchain:** TRON (TRC-20 USDT)
- **Auth:** Telegram WebApp initData validation + JWT

## License

Proprietary — All rights reserved.
