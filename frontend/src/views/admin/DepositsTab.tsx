import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';

export const DepositsTab: React.FC = () => {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  useEffect(() => { loadDeposits(); }, [statusFilter]);

  const loadDeposits = async () => {
    setLoading(true);
    const res = await adminApi.getDeposits(statusFilter);
    if (res.success) setDeposits(res.data || []);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this deposit?')) return;
    await adminApi.approveDeposit(id);
    loadDeposits();
  };

  const handleReject = async (id: string) => {
    if (!confirm('Reject this deposit?')) return;
    await adminApi.rejectDeposit(id);
    loadDeposits();
  };

  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-2xl font-black text-white">Deposit Requests</h2>

      <div className="flex gap-2">
        {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === s ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-dark-700 text-slate-400'
            }`}
          >
            {s} {s === 'PENDING' && deposits.length > 0 ? `(${deposits.length})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : deposits.length === 0 ? (
        <p className="text-slate-500 text-center py-10">No {statusFilter.toLowerCase()} deposits</p>
      ) : (
        <div className="space-y-3">
          {deposits.map(dep => (
            <div key={dep.id} className="bg-dark-700 rounded-xl p-4 border border-dark-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-bold">{fmt(dep.amount)} USDT</p>
                  <p className="text-xs text-slate-400">
                    {dep.userName} (ID: {dep.userId})
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">{dep.date}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Wallet: {dep.walletAddress}</p>
                </div>
                {statusFilter === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(dep.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-2 rounded-lg font-bold transition"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleReject(dep.id)}
                      className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded-lg font-bold transition"
                    >
                      ❌ Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
