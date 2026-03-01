import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Header: React.FC = () => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-dark-900/90 backdrop-blur-xl border-b border-dark-700">
      <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary-500/20">
            K
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">KHQRUP</h1>
            <p className="text-[10px] text-slate-500">
              {user ? `@${user.username || user.firstName}` : 'Wallet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          <span className="text-[10px] text-slate-500">Live</span>
        </div>
      </div>
    </header>
  );
};
