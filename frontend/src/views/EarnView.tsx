import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { View } from '../types';

interface Props {
  setView: (view: View) => void;
}

export const EarnView: React.FC<Props> = ({ setView }) => {
  const { user, config } = useAuth();
  const ic = config?.interestConfig;
  const formatMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="px-4 py-6 animate-fade-in space-y-6">
      <h2 className="text-xl font-bold text-white">Earn Interest</h2>

      {/* Interest Tiers */}
      {ic?.isEnabled && (
        <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
          <h3 className="text-sm font-bold text-white mb-3">Interest Tiers</h3>
          <div className="space-y-2">
            {ic.tiers.map((tier, i) => (
              <div key={i} className="flex items-center justify-between bg-dark-800 rounded-lg p-3">
                <span className="text-xs text-slate-400">
                  {formatMoney(tier.minBalance)} - {tier.maxBalance >= 999999 ? '∞' : formatMoney(tier.maxBalance)} USDT
                </span>
                <span className="text-sm font-bold text-primary-400">{tier.apy}% APY</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-3">
            Min balance to earn: {formatMoney(ic.minBalanceToEarn)} USDT | Daily cap: {formatMoney(ic.dailyPayoutCap)} USDT
          </p>
        </div>
      )}

      {/* Your Balance */}
      <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
        <p className="text-xs text-slate-400 mb-1">Your Balance</p>
        <p className="text-2xl font-bold text-white">{formatMoney(user?.balance || 0)} USDT</p>
        {(user?.lockedBalance || 0) > 0 && (
          <p className="text-xs text-slate-500 mt-1">🔒 {formatMoney(user!.lockedBalance)} USDT in savings</p>
        )}
      </div>

      {/* Info */}
      <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
        <h3 className="text-sm font-bold text-white mb-2">How it works</h3>
        <ul className="space-y-1.5 text-xs text-slate-400">
          <li>• Interest accrues daily on your available balance</li>
          <li>• Claim your interest once per day from the Home screen</li>
          <li>• Higher balances may qualify for different APY tiers</li>
          <li>• Interest is paid in USDT</li>
        </ul>
      </div>
    </div>
  );
};
