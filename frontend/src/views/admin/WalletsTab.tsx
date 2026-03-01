import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';

export const WalletsTab: React.FC = () => {
  const [wallets, setWallets] = useState<any[]>([]);
  const [energy, setEnergy] = useState<any>(null);
  const [energyLogs, setEnergyLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'wallets' | 'energy'>('wallets');
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [consolidating, setConsolidating] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<any>(null);

  useEffect(() => { loadAll(); }, [onlyWithBalance]);

  const loadAll = async () => {
    setLoading(true);
    const [wRes, eRes] = await Promise.all([
      adminApi.getWallets(onlyWithBalance),
      adminApi.getEnergy(),
    ]);
    if (wRes.success) setWallets(wRes.data || []);
    if (eRes.success) setEnergy(eRes.data);
    setLoading(false);
  };

  const loadEnergyLogs = async () => {
    const res = await adminApi.getEnergyLogs();
    if (res.success) setEnergyLogs(res.data || []);
  };

  useEffect(() => { if (tab === 'energy') loadEnergyLogs(); }, [tab]);

  const handleRefreshAll = async () => {
    setLoading(true);
    await adminApi.refreshAllWallets();
    await loadAll();
  };

  const handleConsolidate = async (address: string, amount: number) => {
    if (!confirm(`Consolidate ${amount} USDT from ${address}?`)) return;
    setConsolidating(address);
    const res = await adminApi.consolidateWallet(address, amount);
    setConsolidating(null);
    if (res.success) {
      alert('Consolidation successful!');
      loadAll();
    } else {
      alert(`Failed: ${res.error}`);
    }
  };

  const handleConsolidateAll = async () => {
    if (!confirm('Consolidate ALL wallets above threshold?')) return;
    setLoading(true);
    const res = await adminApi.consolidateAll();
    setLoading(false);
    if (res.success) {
      setBatchResult(res.data);
    } else {
      alert(`Failed: ${res.error}`);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    const res = await adminApi.stakeEnergy(parseFloat(stakeAmount));
    if (res.success) {
      setStakeAmount('');
      loadAll();
      loadEnergyLogs();
    } else {
      alert(`Stake failed: ${res.error}`);
    }
  };

  const handleUnstake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    const res = await adminApi.unstakeEnergy(parseFloat(stakeAmount));
    if (res.success) {
      setStakeAmount('');
      loadAll();
      loadEnergyLogs();
    } else {
      alert(`Unstake failed: ${res.error}`);
    }
  };

  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-2xl font-black text-white">Wallets & Energy</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('wallets')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'wallets' ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-dark-700 text-slate-400'
          }`}
        >
          💰 Child Wallets ({wallets.length})
        </button>
        <button
          onClick={() => setTab('energy')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'energy' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-dark-700 text-slate-400'
          }`}
        >
          ⚡ Energy Management
        </button>
      </div>

      {/* WALLETS TAB */}
      {tab === 'wallets' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={onlyWithBalance}
                onChange={e => setOnlyWithBalance(e.target.checked)}
                className="rounded"
              />
              Only with balance
            </label>
            <div className="flex-1" />
            <button onClick={handleRefreshAll} className="bg-dark-700 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-xs border border-dark-600 transition">
              🔄 Refresh All
            </button>
            <button onClick={handleConsolidateAll} className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition">
              🔋→💰 Consolidate All
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-700 rounded-xl p-3 border border-dark-600">
              <p className="text-[10px] text-slate-500">Total Wallets</p>
              <p className="text-xl font-bold text-white">{wallets.length}</p>
            </div>
            <div className="bg-dark-700 rounded-xl p-3 border border-dark-600">
              <p className="text-[10px] text-slate-500">Total On-Chain</p>
              <p className="text-xl font-bold text-primary-400">
                {fmt(wallets.reduce((s, w) => s + (w.balanceOnChain || 0), 0))} USDT
              </p>
            </div>
            <div className="bg-dark-700 rounded-xl p-3 border border-dark-600">
              <p className="text-[10px] text-slate-500">Need Consolidation</p>
              <p className="text-xl font-bold text-yellow-400">
                {wallets.filter(w => (w.balanceOnChain || 0) > 0 && !w.isConsolidated).length}
              </p>
            </div>
          </div>

          {/* Wallet List */}
          {loading ? (
            <div className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : (
            <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600 text-slate-500 text-[10px] uppercase">
                    <th className="px-4 py-3 text-left">Address</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-right">On-Chain</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map(w => (
                    <tr key={w.address} className="border-b border-dark-600/50 hover:bg-dark-600/30">
                      <td className="px-4 py-3">
                        <p className="text-xs text-white font-mono">{w.address.slice(0, 10)}...{w.address.slice(-6)}</p>
                        <p className="text-[10px] text-slate-500">Index: {w.index}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-white">{w.userName}</p>
                        <p className="text-[10px] text-slate-500">ID: {w.userId}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className={`text-sm font-bold ${(w.balanceOnChain || 0) > 0 ? 'text-primary-400' : 'text-slate-500'}`}>
                          {fmt(w.balanceOnChain || 0)} USDT
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {w.isConsolidated ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Consolidated</span>
                        ) : (w.balanceOnChain || 0) > 0 ? (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Needs sweep</span>
                        ) : (
                          <span className="text-[10px] bg-dark-800 text-slate-500 px-2 py-0.5 rounded">Empty</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => adminApi.refreshWallet(w.address).then(loadAll)}
                            className="text-[10px] bg-dark-800 text-slate-400 hover:text-white px-2 py-1 rounded transition"
                          >
                            🔄
                          </button>
                          {(w.balanceOnChain || 0) > 0 && (
                            <button
                              onClick={() => handleConsolidate(w.address, w.balanceOnChain)}
                              disabled={consolidating === w.address}
                              className="text-[10px] bg-primary-600 hover:bg-primary-500 text-white px-2 py-1 rounded font-bold transition disabled:opacity-50"
                            >
                              {consolidating === w.address ? '⏳' : '💰 Sweep'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Batch Result */}
          {batchResult && (
            <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
              <h3 className="text-sm font-bold text-white mb-2">Batch Consolidation Result</h3>
              <p className="text-xs text-primary-400 mb-2">Total consolidated: {fmt(batchResult.totalConsolidated)} USDT</p>
              {batchResult.results?.map((r: any, i: number) => (
                <p key={i} className={`text-[10px] ${r.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.address.slice(0, 10)}... → {r.success ? `✅ ${r.txHash}` : `❌ ${r.error}`}
                </p>
              ))}
              <button onClick={() => setBatchResult(null)} className="text-[10px] text-slate-500 mt-2">Dismiss</button>
            </div>
          )}
        </div>
      )}

      {/* ENERGY TAB */}
      {tab === 'energy' && (
        <div className="space-y-4">
          {/* Energy Status */}
          {energy && (
            <div className="bg-dark-700 rounded-xl p-5 border border-dark-600">
              <h3 className="text-sm font-bold text-white mb-4">⚡ Mother Wallet Resources</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500">Address</p>
                  <p className="text-xs text-white font-mono">{energy.motherAddress?.slice(0, 10)}...</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Free TRX</p>
                  <p className="text-lg font-bold text-white">{fmt(energy.totalTRX)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Staked (Energy)</p>
                  <p className="text-lg font-bold text-yellow-400">{fmt(energy.stakedForEnergy)} TRX</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Available Energy</p>
                  <p className="text-lg font-bold text-emerald-400">{energy.availableEnergy?.toLocaleString()}</p>
                </div>
              </div>

              {/* Energy bar */}
              <div className="mt-4">
                <div className="h-3 bg-dark-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, (energy.availableEnergy / Math.max(energy.totalEnergy, 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-500">{energy.availableEnergy?.toLocaleString()} available</span>
                  <span className="text-[10px] text-slate-500">{energy.totalEnergy?.toLocaleString()} total</span>
                </div>
              </div>

              <div className="mt-4 bg-dark-800 rounded-lg p-3">
                <p className="text-xs text-slate-400">
                  Can consolidate <span className="text-primary-400 font-bold">{energy.canConsolidate}</span> wallets with current energy
                  (65,000 energy per transfer)
                </p>
              </div>
            </div>
          )}

          {/* Stake/Unstake */}
          <div className="bg-dark-700 rounded-xl p-5 border border-dark-600">
            <h3 className="text-sm font-bold text-white mb-3">Stake / Unstake TRX</h3>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount TRX"
                value={stakeAmount}
                onChange={e => setStakeAmount(e.target.value)}
                className="flex-1 bg-dark-800 text-white rounded-lg px-4 py-2 text-sm border border-dark-600 focus:outline-none"
              />
              <button
                onClick={handleStake}
                disabled={!stakeAmount}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-dark-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
              >
                📈 Stake
              </button>
              <button
                onClick={handleUnstake}
                disabled={!stakeAmount}
                className="bg-red-600 hover:bg-red-500 disabled:bg-dark-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
              >
                📉 Unstake
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              ~1 TRX ≈ 2,500 energy. Need ~26 TRX staked per consolidation.
            </p>
          </div>

          {/* Energy Logs */}
          <div className="bg-dark-700 rounded-xl p-5 border border-dark-600">
            <h3 className="text-sm font-bold text-white mb-3">Energy Action Log</h3>
            {energyLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No energy actions yet</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-auto">
                {energyLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-dark-600/50">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.action === 'STAKE' ? 'bg-emerald-500/20 text-emerald-400' :
                      log.action === 'DELEGATE' ? 'bg-blue-500/20 text-blue-400' :
                      log.action === 'RECLAIM' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>{log.action}</span>
                    <span className="text-slate-300">{log.amount?.toLocaleString()}</span>
                    {log.targetAddress && <span className="text-slate-500 font-mono text-[10px]">{log.targetAddress?.slice(0, 10)}...</span>}
                    <span className="text-slate-500 ml-auto">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
