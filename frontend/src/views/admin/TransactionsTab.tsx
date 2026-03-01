import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';

export const TransactionsTab: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [pendingRes, allRes] = await Promise.all([
      adminApi.getPendingTransactions(),
      adminApi.getTransactions({ status: statusFilter, type: typeFilter }),
    ]);
    if (pendingRes.success) setPending(pendingRes.data || []);
    if (allRes.success) setTransactions(allRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (tab === 'all') loadData();
  }, [statusFilter, typeFilter]);

  const handleApprove = async (txId: string) => {
    if (!confirm('Approve this transaction?')) return;
    await adminApi.approveTx(txId);
    loadData();
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    await adminApi.rejectTx(rejectModal, rejectReason);
    setRejectModal(null);
    setRejectReason('');
    loadData();
  };

  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      COMPLETED: 'bg-emerald-500/20 text-emerald-400',
      PROCESSING: 'bg-blue-500/20 text-blue-400',
      PENDING_APPROVAL: 'bg-yellow-500/20 text-yellow-400',
      FAILED: 'bg-red-500/20 text-red-400',
      REJECTED: 'bg-red-500/20 text-red-400',
    };
    return map[status] || 'bg-slate-500/20 text-slate-400';
  };

  const renderTxRow = (tx: any, showActions = false) => (
    <tr key={tx.id} className="border-b border-dark-600/50 hover:bg-dark-600/30">
      <td className="px-4 py-3">
        <p className="text-xs text-white font-mono">{tx.id.slice(0, 12)}...</p>
        <p className="text-[10px] text-slate-500">{tx.date}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-white">{tx.userId}</p>
      </td>
      <td className="px-4 py-3">
        <span className="text-[10px] bg-dark-800 text-slate-300 px-2 py-0.5 rounded">{tx.type}</span>
        {tx.qrType && <span className="text-[10px] bg-dark-800 text-primary-400 px-2 py-0.5 rounded ml-1">{tx.qrType}</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-bold text-white">{fmt(tx.amount)} USDT</p>
        {tx.originalAmount && (
          <p className="text-[10px] text-slate-500">{tx.originalAmount.toLocaleString()} {tx.originalCurrency}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-slate-300 truncate max-w-[200px]">{tx.description}</p>
        {tx.merchantName && <p className="text-[10px] text-slate-500">🏪 {tx.merchantName}</p>}
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] px-2 py-0.5 rounded ${statusBadge(tx.status)}`}>{tx.status}</span>
      </td>
      {showActions && (
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button
              onClick={() => handleApprove(tx.id)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2 py-1 rounded font-bold"
            >
              ✅ Approve
            </button>
            <button
              onClick={() => setRejectModal(tx.id)}
              className="bg-red-600 hover:bg-red-500 text-white text-[10px] px-2 py-1 rounded font-bold"
            >
              ❌ Reject
            </button>
          </div>
        </td>
      )}
    </tr>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-2xl font-black text-white">Transactions</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-dark-700 text-slate-400'
          }`}
        >
          ⏳ Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'all' ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-dark-700 text-slate-400'
          }`}
        >
          📋 All Transactions
        </button>
      </div>

      {/* Filters (all tab) */}
      {tab === 'all' && (
        <div className="flex gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-dark-700 text-white rounded-lg px-3 py-2 text-sm border border-dark-600">
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING_APPROVAL">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-dark-700 text-white rounded-lg px-3 py-2 text-sm border border-dark-600">
            <option value="">All Types</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="QR_PAYMENT">QR Payment</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="INTEREST">Interest</option>
            <option value="SAVINGS_LOCK">Savings Lock</option>
          </select>
          <button onClick={() => adminApi.exportTransactions()} className="bg-dark-700 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-sm border border-dark-600 transition">
            📥 Export CSV
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-slate-500 text-[10px] uppercase">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Status</th>
                {tab === 'pending' && <th className="px-4 py-3 text-left">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(tab === 'pending' ? pending : transactions).map(tx => renderTxRow(tx, tab === 'pending'))}
            </tbody>
          </table>
          {(tab === 'pending' ? pending : transactions).length === 0 && (
            <p className="text-slate-500 text-center py-8 text-sm">No transactions</p>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setRejectModal(null)}>
          <div className="bg-dark-700 rounded-xl p-6 w-96 space-y-4 border border-dark-600" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Reject Transaction</h3>
            <p className="text-xs text-slate-400">Balance will be refunded to user</p>
            <input
              type="text"
              placeholder="Reason for rejection"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
              className="w-full bg-dark-800 text-white rounded-lg px-4 py-2 text-sm border border-dark-600 focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 bg-dark-600 text-slate-400 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleReject} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold">Reject & Refund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
