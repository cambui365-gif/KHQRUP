export enum View {
  HOME = 'HOME',
  KHQR = 'KHQR',
  EARN = 'EARN',
  HISTORY = 'HISTORY',
}

export enum Currency {
  USDT = 'USDT',
  KHR = 'KHR',
  USD = 'USD',
  VND = 'VND',
}

export type Language = 'en' | 'vi' | 'zh' | 'km';

export interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  walletAddress: string;
  balance: number;
  lockedBalance: number;
  isLocked: boolean;
  isBlocked: boolean;
  canWithdraw: boolean;
  hasPin: boolean;
  lastInterestClaimDate: string;
}

export interface Transaction {
  id: string;
  userId: number;
  type: string;
  amount: number;
  currency: Currency;
  originalAmount?: number;
  originalCurrency?: Currency;
  date: string;
  timestamp: number;
  status: string;
  description: string;
  merchantName?: string;
  bankName?: string;
  qrType?: string;
}

export interface SystemConfig {
  exchangeRates: Record<Currency, number>;
  maintenanceMode: boolean;
  globalWithdrawEnable: boolean;
  motherWalletAddress: string;
  interestConfig: {
    isEnabled: boolean;
    minBalanceToEarn: number;
    dailyPayoutCap: number;
    tiers: Array<{ minBalance: number; maxBalance: number; apy: number }>;
  };
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
