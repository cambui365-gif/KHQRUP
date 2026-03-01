import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';

export const DashboardTab: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const res = await adminApi.getDashboard();
    if (res.success) setData(res.data);
    setLoading(false);
  };

  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  if (loading) return <Loading />;
  if (!data) return <p className="text-red-400">Failed to load dashboard</p>;

  const { balances, users, wallets, today, pending, energy } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">Dashboard</h2>
        <button onClick={() => { setLoading(true); load(); }} className="text-xs text-primary-400 hover:text-primary-300">
          🔄 Refresh
        </button>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="System Balance"
          value={`${fmt(balances.totalSystemBalance)} USDT`}
          subtitle="Total user balances"
          color="emerald"
        />
        <StatCard
          title="On-Chain"
          value={`${fmt(balances.totalOnChain)} USDT`}
          subtitle="Child wallets total"
          color="blue"
        />
        <StatCard
          title="Discrepancy"
          value={`${fmt(balances.discrepancy)} USDT`}
          subtitle={Math.abs(balances.discrepancy) < 1 ? '✅ Balanced' : '⚠️ Check needed'}
          color={Math.abs(balances.discrepancy) < 1 ? 'emerald' : 'red'}
        />
        <StatCard
          title="Locked in Savings"
          value={`${fmt(balances.totalLockedBalance)} USDT`}
          subtitle="User savings"
          color="purple"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MiniStat icon="👥" label="Users" value={users.total} sub={`${users.active7d} active (7d)`} />
        <MiniStat icon="🔋" label="Wallets" value={wallets.total} sub={`${wallets.withBalance} with balance`} />
        <MiniStat icon="📋" label="Today Txs" value={today.transactionCount} sub={`${fmt(today.volume)} USDT`} />
        <MiniStat icon="❌" label="Failed Today" value={today.failedCount} sub="failed/rejected" />
        <MiniStat
          icon="⏳"
          label="Pending"
          value={pending.total}
          sub={`${pending.transactions} tx, ${pending.deposits} dep`}
          highlight={pending.total > 0}
        />
      </div>

      {/* Energy Status */}
      {energy && (
        <div className="bg-dark-700 rounded-xl p-5 border border-dark-600">
          <h3 className="text-sm font-bold text-white mb-4">⚡ Energy Status (Mother Wallet)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Available TRX</p>
              <p className="text-lg font-bold text-white">{fmt(energy.totalTRX)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Staked for Energy</p>
              <p className="text-lg font-bold text-yellow-400">{fmt(energy.stakedForEnergy)} TRX</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Available Energy</p>
              <p className="text-lg font-bold text-emerald-400">{energy.availableEnergy.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Can Consolidate</p>
              <p className="text-lg font-bold text-blue-400">{energy.canConsolidate} wallets</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, (energy.availableEnergy / Math.max(energy.totalEnergy, 1)) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {energy.availableEnergy.toLocaleString()} / {energy.totalEnergy.toLocaleString()} energy
            </p>
          </div>
        </div>
      )}

      {/* Pending Actions */}
      {pending.total > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-sm text-yellow-400 font-bold">
            ⚠️ {pending.total} item(s) waiting for approval
          </p>
          <p className="text-xs text-yellow-400/70 mt-1">
            {pending.transactions} transaction(s) • {pending.deposits} deposit(s)
          </p>
        </div>
      )}
    </div>
  );
};

// Sub-components
const StatCard: React.FC<{ title: string; value: string; subtitle: string; color: string }> = ({ title, value, subtitle, color }) => {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
    red: 'border-red-500/30 bg-red-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
  };
  return (
    <div className={`rounded-xl p-4 border ${colors[color] || colors.emerald}`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="text-xl font-black text-white mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
};

const MiniStat: React.FC<{ icon: string; label: string; value: number; sub: string; highlight?: boolean }> = ({ icon, label, value, sub, highlight }) => (
  <div className={`bg-dark-700 rounded-xl p-3 border ${highlight ? 'border-yellow-500/50' : 'border-dark-600'}`}>
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
    <p className={`text-xl font-bold mt-1 ${highlight ? 'text-yellow-400' : 'text-white'}`}>{value}</p>
    <p className="text-[10px] text-slate-500">{sub}</p>
  </div>
);

const Loading: React.FC = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
  </div>
);
