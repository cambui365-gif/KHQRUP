import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, setToken, getToken, clearToken, userApi } from '../services/api';
import { UserProfile, SystemConfig } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  config: SystemConfig | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: () => Promise<boolean>;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshUser = async () => {
    const res = await userApi.getProfile();
    if (res.success && res.data) {
      setUser(res.data);
    }
    const configRes = await userApi.getConfig();
    if (configRes.success && configRes.data) {
      setConfig(configRes.data);
    }
  };

  const login = async (): Promise<boolean> => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return false;

    const res = await authApi.loginTelegram(initData);
    if (res.success && res.data) {
      setToken(res.data.token);
      setUser(res.data.user);
      setIsAdmin(res.data.isAdmin);
      await refreshUser();
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

  useEffect(() => {
    const init = async () => {
      // Try existing token first
      const existingToken = getToken();
      if (existingToken) {
        const res = await userApi.getProfile();
        if (res.success && res.data) {
          setUser(res.data);
          await refreshUser();
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
        login,
        loginAdmin,
        logout,
        refreshUser,
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
