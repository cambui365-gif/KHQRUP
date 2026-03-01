import { Currency, TransactionStatus, TransactionType, QRType } from '../config/constants.js';

export interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  walletAddress: string; // TRON child wallet address
  walletIndex: number;   // HD derivation index
  balance: number;
  lockedBalance: number;
  isLocked: boolean;
  isBlocked: boolean;
  canWithdraw: boolean;
  dailyWithdrawLimit: number;
  autoApprovalLimit: number;
  pinHash: string;
  pinAttempts: number;
  photoUrl: string;
  lastInterestClaimDate: string;
  createdAt: number;
  updatedAt: number;
}

export interface WalletRecord {
  address: string;
  userId: number;
  index: number;
  balanceOnChain: number;
  lastChecked: number;
  isConsolidated: boolean;
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId: number;
  type: TransactionType;
  amount: number;
  currency: Currency;
  originalAmount?: number;
  originalCurrency?: Currency;
  date: string;
  timestamp: number;
  status: TransactionStatus;
  description: string;
  merchantName?: string;
  bankName?: string;
  merchantCity?: string;
  recipientAccount?: string;
  rawQrData?: string;
  qrType?: QRType;
  partnerTxId?: string;
  partnerResponseCode?: string;
  approvalType?: 'AUTO' | 'MANUAL';
  beforeBalance?: number;
  afterBalance?: number;
}

export interface SystemConfig {
  exchangeRates: Record<Currency, number>;
  maintenanceMode: boolean;
  globalWithdrawEnable: boolean;
  autoApproveLimit: number;
  motherWalletAddress: string;
  telegramBotToken: string;
  telegramAdminChatId: string;
  consolidationThreshold: number; // Auto-consolidate child wallets above this USDT amount
  interestConfig: InterestConfig;
}

export interface InterestConfig {
  isEnabled: boolean;
  minBalanceToEarn: number;
  dailyPayoutCap: number;
  tiers: InterestTier[];
}

export interface InterestTier {
  minBalance: number;
  maxBalance: number;
  apy: number;
}

export interface SavingsPlan {
  id: string;
  name: string;
  durationDays: number;
  apy: number;
  minAmount: number;
  description: string;
  isActive: boolean;
}

export interface UserSavingsRecord {
  id: string;
  userId: number;
  planId: string;
  planName: string;
  amount: number;
  apy: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'REDEEMED_EARLY';
  autoRenew: boolean;
  accruedInterest: number;
}

export interface DepositRequest {
  id: string;
  userId: number;
  userName: string;
  amount: number;
  walletAddress: string;
  txHash?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  date: string;
  timestamp: number;
}

export interface QRPaymentRequest {
  rawQrData: string;
  amount: number;
  currency: Currency;
  pin: string;
  note?: string;
}

export interface PartnerPaymentRequest {
  transactionId: string;
  qrType: QRType;
  bankCode: string;
  accountNumber: string;
  amount: number;
  currency: Currency;
  merchantName: string;
  rawQrData: string;
}

export interface PartnerPaymentResponse {
  success: boolean;
  partnerTxId?: string;
  responseCode?: string;
  message?: string;
}

export interface TelegramInitData {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
}

export interface JWTPayload {
  userId: number;
  username: string;
  isAdmin?: boolean;
}
