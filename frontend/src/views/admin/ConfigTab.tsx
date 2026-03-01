import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';

export const ConfigTab: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    const res = await adminApi.getConfig();
    if (res.success) setConfig(res.data);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await adminApi.updateConfig(config);
    setSaving(false);
    if (res.success) {
      setEdited(false);
      alert('Config saved!');
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const update = (path: string, value: any) => {
    const parts = path.split('.');
    const newConfig = JSON.parse(JSON.stringify(config));
    let obj = newConfig;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
    setConfig(newConfig);
    setEdited(true);
  };

  if (loading) return <div className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!config) return <p className="text-red-400">Failed to load config</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">System Settings</h2>
        <button
          onClick={handleSave}
          disabled={!edited || saving}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
            edited ? 'bg-primary-600 hover:bg-primary-500 text-white' : 'bg-dark-700 text-slate-500'
          }`}
        >
          {saving ? 'Saving...' : edited ? '💾 Save Changes' : 'No Changes'}
        </button>
      </div>

      {/* Exchange Rates */}
      <Section title="💱 Exchange Rates">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(config.exchangeRates || {}).map(([currency, rate]) => (
            <div key={currency}>
              <label className="text-[10px] text-slate-500 uppercase">{currency} per USDT</label>
              <input
                type="number"
                value={rate as number}
                onChange={e => update(`exchangeRates.${currency}`, parseFloat(e.target.value))}
                className="w-full bg-dark-800 text-white rounded-lg px-3 py-2 text-sm border border-dark-600 focus:outline-none mt-1"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* System Controls */}
      <Section title="🔧 System Controls">
        <div className="space-y-3">
          <Toggle
            label="Maintenance Mode"
            desc="Disable all operations when enabled"
            value={config.maintenanceMode}
            onChange={v => update('maintenanceMode', v)}
          />
          <Toggle
            label="Global Withdraw"
            desc="Enable/disable all withdrawals"
            value={config.globalWithdrawEnable}
            onChange={v => update('globalWithdrawEnable', v)}
          />
          <div>
            <label className="text-xs text-slate-400">Auto-Approve Limit (USDT)</label>
            <input
              type="number"
              value={config.autoApproveLimit}
              onChange={e => update('autoApproveLimit', parseFloat(e.target.value))}
              className="w-full bg-dark-800 text-white rounded-lg px-3 py-2 text-sm border border-dark-600 focus:outline-none mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Consolidation Threshold (USDT)</label>
            <input
              type="number"
              value={config.consolidationThreshold}
              onChange={e => update('consolidationThreshold', parseFloat(e.target.value))}
              className="w-full bg-dark-800 text-white rounded-lg px-3 py-2 text-sm border border-dark-600 focus:outline-none mt-1"
            />
          </div>
        </div>
      </Section>

      {/* Interest Config */}
      <Section title="📈 Interest Configuration">
        <Toggle
          label="Interest Enabled"
          desc="Allow users to earn daily interest"
          value={config.interestConfig?.isEnabled}
          onChange={v => update('interestConfig.isEnabled', v)}
        />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-[10px] text-slate-500">Min Balance to Earn</label>
            <input
              type="number"
              value={config.interestConfig?.minBalanceToEarn}
              onChange={e => update('interestConfig.minBalanceToEarn', parseFloat(e.target.value))}
              className="w-full bg-dark-800 text-white rounded-lg px-3 py-2 text-sm border border-dark-600 focus:outline-none mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Daily Payout Cap</label>
            <input
              type="number"
              value={config.interestConfig?.dailyPayoutCap}
              onChange={e => update('interestConfig.dailyPayoutCap', parseFloat(e.target.value))}
              className="w-full bg-dark-800 text-white rounded-lg px-3 py-2 text-sm border border-dark-600 focus:outline-none mt-1"
            />
          </div>
        </div>
        {config.interestConfig?.tiers && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-400">Interest Tiers</p>
            {config.interestConfig.tiers.map((tier: any, i: number) => (
              <div key={i} className="grid grid-cols-3 gap-2 bg-dark-800 rounded-lg p-2">
                <input
                  type="number" placeholder="Min"
                  value={tier.minBalance}
                  onChange={e => update(`interestConfig.tiers.${i}.minBalance`, parseFloat(e.target.value))}
                  className="bg-dark-900 text-white rounded px-2 py-1 text-xs border border-dark-600"
                />
                <input
                  type="number" placeholder="Max"
                  value={tier.maxBalance}
                  onChange={e => update(`interestConfig.tiers.${i}.maxBalance`, parseFloat(e.target.value))}
                  className="bg-dark-900 text-white rounded px-2 py-1 text-xs border border-dark-600"
                />
                <input
                  type="number" placeholder="APY %"
                  value={tier.apy}
                  onChange={e => update(`interestConfig.tiers.${i}.apy`, parseFloat(e.target.value))}
                  className="bg-dark-900 text-white rounded px-2 py-1 text-xs border border-dark-600"
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Wallet */}
      <Section title="💰 Mother Wallet">
        <div>
          <label className="text-xs text-slate-400">Mother Wallet Address</label>
          <input
            type="text"
            value={config.motherWalletAddress}
            onChange={e => update('motherWalletAddress', e.target.value)}
            className="w-full bg-dark-800 text-white rounded-lg px-3 py-2 text-sm border border-dark-600 focus:outline-none mt-1 font-mono"
          />
        </div>
      </Section>
    </div>
  );
};

// Sub-components
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-dark-700 rounded-xl p-5 border border-dark-600">
    <h3 className="text-sm font-bold text-white mb-4">{title}</h3>
    {children}
  </div>
);

const Toggle: React.FC<{ label: string; desc: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, desc, value, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-xs text-white font-medium">{label}</p>
      <p className="text-[10px] text-slate-500">{desc}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-all ${value ? 'bg-primary-500' : 'bg-dark-600'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  </div>
);
