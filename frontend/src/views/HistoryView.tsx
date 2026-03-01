import React, { useState, useEffect } from 'react';
import { userApi } from '../services/api';
import { Transaction } from '../types';

export const HistoryView: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    const res = await userApi.getTransactions(100);
    if (res.success) setTransactions(res.data || []);
    setLoading(false);
  };

  const formatMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const typeIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT': return '📥';
      case 'QR_PAYMENT': return '📤';
      case 'INTEREST': return '💰';
      case 'ADJUSTMENT': return '⚖️';
      case 'SAVINGS_LOCK': return '🔒';
      case 'SAVINGS_REDEEM': return '🔓';
      default: return '📋';
    }
  };

  const isIncoming = (type: string) => ['DEPOSIT', 'INTEREST', 'SAVINGS_REDEEM'].includes(type);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-primary-500/20 text-primary-400',
      PROCESSING: 'bg-yellow-500/20 text-yellow-400',
      PENDING_APPROVAL: 'bg-yellow-500/20 text-yellow-400',
      FAILED: 'bg-red-500/20 text-red-400',
      REJECTED: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 animate-fade-in">
      <h2 className="text-xl font-bold text-white mb-4">Transaction History</h2>

      {transactions.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl">📋</span>
          <p className="text-slate-500 mt-2">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-dark-700 rounded-xl p-4 border border-dark-600">
              <div className="flex items-start gap-3">
                <span className="text-xl">{typeIcon(tx.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white font-medium truncate">{tx.description}</p>
                    <p className={`text-sm font-bold whitespace-nowrap ml-2 ${isIncoming(tx.type) ? 'text-primary-400' : 'text-red-400'}`}>
                      {isIncoming(tx.type) ? '+' : '-'}{formatMoney(tx.amount)} USDT
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500">{tx.date}</span>
                    {tx.qrType && (
                      <span className="text-[10px] bg-dark-800 text-slate-400 px-1.5 py-0.5 rounded">{tx.qrType}</span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusBadge(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>
                  {tx.merchantName && (
                    <p className="text-[10px] text-slate-500 mt-1">🏪 {tx.merchantName}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
