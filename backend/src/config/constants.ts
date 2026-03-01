export enum Currency {
  USDT = 'USDT',
  KHR = 'KHR',
  USD = 'USD',
  VND = 'VND',
}

export enum TransactionStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  QR_PAYMENT = 'QR_PAYMENT',
  SWAP = 'SWAP',
  ADJUSTMENT = 'ADJUSTMENT',
  INTEREST = 'INTEREST',
  SAVINGS_LOCK = 'SAVINGS_LOCK',
  SAVINGS_REDEEM = 'SAVINGS_REDEEM',
  WALLET_CONSOLIDATION = 'WALLET_CONSOLIDATION',
}

export enum QRType {
  KHQR = 'KHQR',
  VIETQR = 'VIETQR',
  UNKNOWN = 'UNKNOWN',
}

export const COLLECTIONS = {
  USERS: 'users',
  TRANSACTIONS: 'transactions',
  WALLETS: 'wallets',
  CONFIG: 'config',
  DEPOSIT_REQUESTS: 'deposit_requests',
  SAVINGS_PLANS: 'savings_plans',
  USER_SAVINGS: 'user_savings',
} as const;

export const PIN_MAX_ATTEMPTS = 5;
export const MOCK_PAYMENT_DELAY_MS = 10_000;
