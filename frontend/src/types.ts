export enum View {
  HOME = 'HOME',
  KHQR = 'KHQR',
  EARN = 'EARN',
  ASSISTANT = 'ASSISTANT',
}

export enum Currency {
  USDT = 'USDT',
  KHR = 'KHR',
  USD = 'USD',
  VND = 'VND',
}

export type Language = 'en' | 'vi' | 'zh' | 'km';

export type TransactionStatus =
  | 'PENDING_APPROVAL'
  | 'QUEUED_FOR_BOT'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED';

export type TransactionType = 'DEPOSIT' | 'SWAP' | 'PAYMENT' | 'ADJUSTMENT' | 'KHQR_SCAN' | 'INTEREST' | 'SAVINGS_LOCK' | 'SAVINGS_REDEEM';

export interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  walletAddress: string;
  customDepositAddress?: string;
  balance: number;
  lockedBalance: number;
  isLocked: boolean;
  isBlocked: boolean;
  canWithdraw: boolean;
  hasPin: boolean;
  pinHash?: string;
  lastInterestClaimDate: string;
}

export interface Transaction {
  id: string;
  userId?: number;
  type: TransactionType | string;
  amount: number;
  currency: Currency;
  originalAmount?: number;
  originalCurrency?: Currency;
  date: string;
  timestamp?: number;
  status: string;
  description?: string;
  merchantName?: string;
  merchantCity?: string;
  bankName?: string;
  qrType?: string;
  partnerSrcId?: string;
  recipientAccount?: string;
  beforeBalance?: number;
  afterBalance?: number;
}

export interface SystemConfig {
  exchangeRates: Record<string, number>;
  maintenanceMode: boolean;
  globalWithdrawEnable: boolean;
  motherWalletAddress: string;
  telegramSupportUrl?: string;
  geminiApiKey?: string;
  interestConfig: {
    isEnabled: boolean;
    minBalanceToEarn: number;
    dailyPayoutCap: number;
    tiers: Array<{ minBalance: number; maxBalance: number; apy: number }>;
  };
}

export interface SavingsPlan {
  id: string;
  name: string;
  durationDays: number;
  apy: number;
  minAmount: number;
  isActive: boolean;
}

export interface UserSavingsRecord {
  id: string;
  planName: string;
  amount: number;
  apy: number;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
}

export interface WalletInfo {
  address: string;
  userId: number;
  index: number;
  balanceOnChain: number;
  lastChecked: number;
}

export interface ParsedQR {
  type: string;
  bankCode: string;
  accountNumber: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  currency: string;
  currencyName: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        showScanQrPopup: (params: { text?: string }, callback: (text: string) => boolean | void) => void;
        closeScanQrPopup: () => void;
        ready: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
      };
    };
  }
}
