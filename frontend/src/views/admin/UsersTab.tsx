import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';

export const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  const [pagination, setPagination] = useState<any>({});

  useEffect(() => { loadUsers(); }, [search, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    const res = await adminApi.getUsers({ search, status: statusFilter });
    if (res.success) {
      setUsers(res.data || []);
      setPagination(res.pagination);
    }
    setLoading(false);
  };

  const openUserDetail = async (userId: number) => {
    const res = await adminApi.getUser(userId);
    if (res.success) {
      setUserDetail(res.data);
      setSelectedUser(userId);
    }
  };

  const handleAdjust = async () => {
    if (!adjustAmount || !adjustDesc || !selectedUser) return;
    const res = await adminApi.adjustBalance(selectedUser, parseFloat(adjustAmount), adjustDesc);
    if (res.success) {
      setAdjustModal(false);
      setAdjustAmount('');
      setAdjustDesc('');
      openUserDetail(selectedUser);
      loadUsers();
    }
  };

  const handleBlock = async (userId: number) => {
    if (!confirm('Toggle block status?')) return;
    await adminApi.blockUser(userId);
    loadUsers();
    if (selectedUser === userId) openUserDetail(userId);
  };

  const handleResetPin = async (userId: number) => {
    if (!confirm('Reset PIN for this user?')) return;
    await adminApi.resetPin(userId);
    if (selectedUser === userId) openUserDetail(userId);
  };

  const handleDelete = async (userId: number) => {
    if (!confirm(`DELETE user ${userId}? This cannot be undone!`)) return;
    if (!confirm(`Are you SURE? All data will be permanently deleted.`)) return;
    await adminApi.deleteUser(userId);
    setSelectedUser(null);
    setUserDetail(null);
    loadUsers();
  };

  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-2xl font-black text-white">Users</h2>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by ID, name, username, wallet..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-dark-700 text-white rounded-lg px-4 py-2 text-sm border border-dark-600 focus:border-primary-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-dark-700 text-white rounded-lg px-3 py-2 text-sm border border-dark-600"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
          <option value="locked">Locked</option>
        </select>
      </div>

      <div className="flex gap-6">
        {/* User List */}
        <div className={`${selectedUser ? 'w-1/2' : 'w-full'} space-y-2 transition-all`}>
          {loading ? (
            <div className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : users.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No users found</p>
          ) : (
            <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600 text-slate-500 text-[10px] uppercase">
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr
                      key={u.id}
                      onClick={() => openUserDetail(u.id)}
                      className={`border-b border-dark-600/50 cursor-pointer transition hover:bg-dark-600/50 ${
                        selectedUser === u.id ? 'bg-primary-500/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{u.firstName}</p>
                        <p className="text-[10px] text-slate-500">@{u.username || u.id}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-white font-bold">{fmt(u.balance)}</p>
                        <p className="text-[10px] text-slate-500">USDT</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.isBlocked ? (
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Blocked</span>
                        ) : u.isLocked ? (
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Locked</span>
                        ) : (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pagination.totalPages > 1 && (
            <p className="text-xs text-slate-500 text-center">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
            </p>
          )}
        </div>

        {/* User Detail Panel */}
        {selectedUser && userDetail && (
          <div className="w-1/2 bg-dark-700 rounded-xl border border-dark-600 p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{userDetail.user.firstName}</h3>
                <p className="text-xs text-slate-500">ID: {userDetail.user.id} • @{userDetail.user.username}</p>
              </div>
              <button onClick={() => { setSelectedUser(null); setUserDetail(null); }} className="text-slate-500 hover:text-white">✕</button>
            </div>

            {/* Balance */}
            <div className="bg-dark-800 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500">Balance</p>
                  <p className="text-xl font-black text-primary-400">{fmt(userDetail.user.balance)} USDT</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Locked</p>
                  <p className="text-xl font-bold text-slate-300">{fmt(userDetail.user.lockedBalance)} USDT</p>
                </div>
              </div>
            </div>

            {/* Wallet */}
            {userDetail.wallet && (
              <div className="bg-dark-800 rounded-lg p-4">
                <p className="text-[10px] text-slate-500 mb-1">Deposit Wallet</p>
                <p className="text-xs text-white font-mono break-all">{userDetail.wallet.address}</p>
                <p className="text-[10px] text-slate-500 mt-1">On-chain: {fmt(userDetail.wallet.balanceOnChain)} USDT</p>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-dark-800 rounded-lg p-2">
                <p className="text-[10px] text-slate-500">Deposits</p>
                <p className="text-sm font-bold text-emerald-400">{fmt(userDetail.summary.totalDeposits)}</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-2">
                <p className="text-[10px] text-slate-500">Payments</p>
                <p className="text-sm font-bold text-red-400">{fmt(userDetail.summary.totalPayments)}</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-2">
                <p className="text-[10px] text-slate-500">Interest</p>
                <p className="text-sm font-bold text-yellow-400">{fmt(userDetail.summary.totalInterest)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAdjustModal(true)}
                className="bg-primary-600 hover:bg-primary-500 text-white py-2 rounded-lg text-xs font-bold transition"
              >
                ⚖️ Adjust Balance
              </button>
              <button
                onClick={() => handleBlock(selectedUser)}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  userDetail.user.isBlocked
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {userDetail.user.isBlocked ? '🔓 Unblock' : '🔒 Block'}
              </button>
              <button
                onClick={() => handleResetPin(selectedUser)}
                className="bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-lg text-xs font-bold transition"
              >
                🔑 Reset PIN
              </button>
              <button
                onClick={() => handleDelete(selectedUser)}
                className="bg-dark-600 hover:bg-red-600 text-slate-400 hover:text-white py-2 rounded-lg text-xs font-bold transition"
              >
                🗑️ Delete
              </button>
            </div>

            {/* Adjust Balance Modal */}
            {adjustModal && (
              <div className="bg-dark-800 rounded-lg p-4 border border-dark-600 space-y-3">
                <h4 className="text-sm font-bold text-white">Adjust Balance</h4>
                <input
                  type="number"
                  placeholder="Amount (negative to deduct)"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  className="w-full bg-dark-900 text-white rounded-lg px-3 py-2 text-sm border border-dark-600 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Reason (required)"
                  value={adjustDesc}
                  onChange={e => setAdjustDesc(e.target.value)}
                  className="w-full bg-dark-900 text-white rounded-lg px-3 py-2 text-sm border border-dark-600 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setAdjustModal(false)} className="flex-1 bg-dark-600 text-slate-400 py-2 rounded-lg text-xs">Cancel</button>
                  <button
                    onClick={handleAdjust}
                    disabled={!adjustAmount || !adjustDesc}
                    className="flex-1 bg-primary-600 disabled:bg-dark-600 text-white py-2 rounded-lg text-xs font-bold"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
