import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, setToken, getToken, clearToken, userApi, paymentApi } from '../services/api';
import { UserProfile, SystemConfig, Language, Currency, Transaction, SavingsPlan, UserSavingsRecord } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  config: SystemConfig | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  lang: Language;
  setLang: (lang: Language) => void;
  login: () => Promise<boolean>;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  // Wallet data
  transactions: Transaction[];
  walletAddress: string;
  pendingInterest: number;
  currentApy: number;
  savingsPlans: SavingsPlan[];
  userSavings: UserSavingsRecord[];
  // Actions
  requestDeposit: (amount: number) => Promise<boolean>;
  claimInterest: () => Promise<boolean>;
  setUserPin: (pin: string) => Promise<void>;
  subscribeToPlan: (planId: string, amount: number, autoRenew: boolean) => Promise<boolean>;
  pay: (amount: number, currency: Currency, pin: string, merchantName?: string, rawQr?: string, bankName?: string, userNote?: string, merchantCity?: string, recipientAccount?: string) => Promise<any>;
  // Deposit modal
  isDepositModalOpen: boolean;
  setDepositModalOpen: (open: boolean) => void;
  // Refresh
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletAddress, setWalletAddress] = useState('');
  const [pendingInterest, setPendingInterest] = useState(0);
  const [currentApy, setCurrentApy] = useState(0);
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([]);
  const [userSavings, setUserSavings] = useState<UserSavingsRecord[]>([]);
  const [isDepositModalOpen, setDepositModalOpen] = useState(false);

  const calculateInterest = (userProfile: UserProfile | null, sysConfig: SystemConfig | null) => {
    if (!userProfile || !sysConfig?.interestConfig) {
      setPendingInterest(0);
      setCurrentApy(0);
      return;
    }
    const ic = sysConfig.interestConfig;
    if (!ic.isEnabled || userProfile.balance < ic.minBalanceToEarn) {
      setPendingInterest(0);
      setCurrentApy(0);
      return;
    }
    let apy = 0;
    for (const tier of ic.tiers) {
      if (userProfile.balance >= tier.minBalance && userProfile.balance < tier.maxBalance) {
        apy = tier.apy;
        break;
      }
    }
    const interest = Math.min((userProfile.balance * (apy / 100)) / 365, ic.dailyPayoutCap);
    setPendingInterest(interest);
    setCurrentApy(apy);
  };

  const refreshData = async () => {
    const [profileRes, configRes, txRes, walletRes] = await Promise.all([
      userApi.getProfile(),
      userApi.getConfig(),
      userApi.getTransactions(20),
      userApi.getWallet(),
    ]);
    if (profileRes.success && profileRes.data) setUser(profileRes.data);
    if (configRes.success && configRes.data) setConfig(configRes.data);
    if (txRes.success && txRes.data) setTransactions(txRes.data);
    if (walletRes.success && walletRes.data) setWalletAddress(walletRes.data.address || '');

    // Calculate interest
    const u = profileRes.success ? profileRes.data : user;
    const c = configRes.success ? configRes.data : config;
    calculateInterest(u, c);

    // Load savings
    try {
      const [plansRes, savingsRes] = await Promise.all([
        userApi.getSavingsPlans(),
        userApi.getUserSavings(),
      ]);
      if (plansRes.success && plansRes.data) setSavingsPlans(plansRes.data);
      if (savingsRes.success && savingsRes.data) setUserSavings(savingsRes.data);
    } catch { /* savings endpoints may not exist yet */ }
  };

  const refreshUser = async () => {
    await refreshData();
  };

  const login = async (): Promise<boolean> => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return false;

    const res = await authApi.loginTelegram(initData);
    if (res.success && res.data) {
      setToken(res.data.token);
      setUser(res.data.user);
      setIsAdmin(res.data.isAdmin);
      await refreshData();
      return true;
    }
    return false;
  };

  const loginAdmin = async (username: string, password: string): Promise<boolean> => {
    const res = await authApi.loginAdmin(username, password);
    if (res.success && res.data) {
      setToken(res.data.token);
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setIsAdmin(false);
  };

  const requestDeposit = async (amount: number): Promise<boolean> => {
    const res = await userApi.requestDeposit(amount);
    if (res.success) {
      await refreshData();
      return true;
    }
    return false;
  };

  const claimInterest = async (): Promise<boolean> => {
    const res = await userApi.claimInterest();
    if (res.success) {
      await refreshData();
      return true;
    }
    return false;
  };

  const setUserPin = async (pin: string) => {
    await userApi.setPin(pin);
    await refreshData();
  };

  const subscribeToPlan = async (planId: string, amount: number, autoRenew: boolean): Promise<boolean> => {
    const res = await userApi.subscribeToPlan(planId, amount, autoRenew);
    if (res.success) {
      await refreshData();
      return true;
    }
    return false;
  };

  const pay = async (amount: number, currency: Currency, pin: string, merchantName?: string, rawQr?: string, bankName?: string, userNote?: string, merchantCity?: string, recipientAccount?: string) => {
    const res = await paymentApi.payQR({
      rawQrData: rawQr || '',
      amount,
      currency,
      pin,
      note: userNote,
    });
    if (res.success && res.data) {
      // Poll for result
      const txId = res.data.transactionId;
      const maxAttempts = 30;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await paymentApi.getStatus(txId);
        if (statusRes.success && statusRes.data) {
          const status = statusRes.data.status;
          if (status === 'COMPLETED' || status === 'FAILED' || status === 'REJECTED') {
            await refreshData();
            return {
              success: status === 'COMPLETED',
              transaction: statusRes.data,
              isWrongPin: false,
              error: status !== 'COMPLETED' ? statusRes.data.description : undefined,
            };
          }
        }
      }
      await refreshData();
      return { success: false, error: 'Payment timeout' };
    }
    // Check for wrong PIN
    const isWrongPin = res.error?.toLowerCase().includes('pin');
    return {
      success: false,
      error: res.error || 'Payment failed',
      isWrongPin,
      remainingAttempts: 0,
    };
  };

  useEffect(() => {
    const init = async () => {
      // Try existing token first
      const existingToken = getToken();
      if (existingToken) {
        const res = await userApi.getProfile();
        if (res.success && res.data) {
          setUser(res.data);
          await refreshData();
          setIsLoading(false);
          return;
        }
        clearToken();
      }

      // Try Telegram login
      if (window.Telegram?.WebApp?.initData) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        await login();
      }

      setIsLoading(false);
    };

    init();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        config,
        isLoading,
        isAdmin,
        isAuthenticated: !!user || isAdmin,
        lang,
        setLang,
        login,
        loginAdmin,
        logout,
        refreshUser,
        transactions,
        walletAddress,
        pendingInterest,
        currentApy,
        savingsPlans,
        userSavings,
        requestDeposit,
        claimInterest,
        setUserPin,
        subscribeToPlan,
        pay,
        isDepositModalOpen,
        setDepositModalOpen,
        refreshData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
