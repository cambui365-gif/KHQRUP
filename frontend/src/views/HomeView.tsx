import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { View, Transaction } from '../types';

interface Props {
  setView: (view: View) => void;
}

export const HomeView: React.FC<Props> = ({ setView }) => {
  const { user, config, refreshUser } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);
  const [showAddress, setShowAddress] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [walletRes, txRes] = await Promise.all([
      userApi.getWallet(),
      userApi.getTransactions(5),
    ]);
    if (walletRes.success) setWallet(walletRes.data);
    if (txRes.success) setRecentTxs(txRes.data || []);
  };

  const handleClaimInterest = async () => {
    setClaiming(true);
    const res = await userApi.claimInterest();
    if (res.success) {
      await refreshUser();
      await loadData();
    }
    setClaiming(false);
  };

  const calculateInterest = () => {
    if (!user || !config?.interestConfig) return { interest: 0, apy: 0 };
    const ic = config.interestConfig;
    if (!ic.isEnabled || user.balance < ic.minBalanceToEarn) return { interest: 0, apy: 0 };

    let apy = 0;
    for (const tier of ic.tiers) {
      if (user.balance >= tier.minBalance && user.balance < tier.maxBalance) {
        apy = tier.apy;
        break;
      }
    }
    const interest = Math.min((user.balance * (apy / 100)) / 365, ic.dailyPayoutCap);
    return { interest, apy };
  };

  const { interest, apy } = calculateInterest();
  const today = new Date().toISOString().split('T')[0];
  const alreadyClaimed = user?.lastInterestClaimDate === today;

  const formatMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const statusColor = (s: string) => {
    if (s === 'COMPLETED') return 'text-primary-400';
    if (s === 'FAILED' || s === 'REJECTED') return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="px-4 py-6 animate-fade-in space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-dark-700 to-dark-800 rounded-2xl p-6 border border-dark-600 animate-pulse-glow">
        <p className="text-slate-400 text-xs mb-1">Total Balance</p>
        <h2 className="text-3xl font-black text-white">
          {formatMoney(user?.balance || 0)} <span className="text-lg text-primary-400">USDT</span>
        </h2>
        {(user?.lockedBalance || 0) > 0 && (
          <p className="text-xs text-slate-500 mt-1">🔒 Locked: {formatMoney(user!.lockedBalance)} USDT</p>
        )}

        {/* Deposit Address */}
        <div className="mt-4 pt-4 border-t border-dark-600">
          <button
            onClick={() => setShowAddress(!showAddress)}
            className="text-xs text-primary-400 hover:text-primary-300 transition"
          >
            {showAddress ? '▼ Hide' : '▶ Show'} Deposit Address
          </button>
          {showAddress && wallet && (
            <div className="mt-2 bg-dark-900 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 mb-1">Send USDT (TRC-20) to:</p>
              <p className="text-xs text-white font-mono break-all select-all">{wallet.address}</p>
              <p className="text-[10px] text-yellow-500 mt-2">⚠️ Only send USDT-TRC20. Other tokens will be lost.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView(View.KHQR)}
          className="bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-xl p-4 text-center transition-all active:scale-95"
        >
          <span className="text-2xl">📷</span>
          <p className="text-xs text-slate-300 mt-1 font-medium">Scan & Pay</p>
        </button>
        <button
          onClick={() => setView(View.EARN)}
          className="bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-xl p-4 text-center transition-all active:scale-95"
        >
          <span className="text-2xl">📈</span>
          <p className="text-xs text-slate-300 mt-1 font-medium">Earn Interest</p>
        </button>
      </div>

      {/* Daily Interest */}
      {interest > 0 && (
        <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Daily Interest ({apy}% APY)</p>
              <p className="text-lg font-bold text-primary-400">+{formatMoney(interest)} USDT</p>
            </div>
            <button
              onClick={handleClaimInterest}
              disabled={claiming || alreadyClaimed}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                alreadyClaimed
                  ? 'bg-dark-600 text-slate-500 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-500 text-white active:scale-95'
              }`}
            >
              {claiming ? '...' : alreadyClaimed ? 'Claimed ✓' : 'Claim'}
            </button>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
          <button onClick={() => setView(View.HISTORY)} className="text-xs text-primary-400">
            View All →
          </button>
        </div>
        {recentTxs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {recentTxs.map(tx => (
              <div key={tx.id} className="bg-dark-700 rounded-xl p-3 border border-dark-600">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{tx.description}</p>
                    <p className="text-[10px] text-slate-500">{tx.date}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className={`text-sm font-bold ${tx.type === 'DEPOSIT' || tx.type === 'INTEREST' ? 'text-primary-400' : 'text-red-400'}`}>
                      {tx.type === 'DEPOSIT' || tx.type === 'INTEREST' || tx.type === 'ADJUSTMENT' ? '+' : '-'}
                      {formatMoney(tx.amount)}
                    </p>
                    <p className={`text-[10px] ${statusColor(tx.status)}`}>{tx.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
