import React, { useState } from 'react';
import { Currency, Language, SavingsPlan, View } from '../types';
import { TRANSLATIONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { formatNumber, formatMoney } from '../utils/format';

interface EarnViewProps {
  lang: Language;
  setView: (view: View) => void;
}

export const EarnView: React.FC<EarnViewProps> = ({ lang, setView }) => {
  const {
    user,
    config: systemConfig,
    pendingInterest,
    currentApy,
    claimInterest,
    savingsPlans,
    userSavings,
    subscribeToPlan,
  } = useAuth();

  const balance = user?.balance || 0;
  const lockedBalance = user?.lockedBalance || 0;
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState<'MARKET' | 'MY_HOLDINGS'>('MARKET');
  const [selectedPlan, setSelectedPlan] = useState<SavingsPlan | null>(null);
  const [subAmount, setSubAmount] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const totalAsset = balance + lockedBalance;
  const spendablePercent = totalAsset > 0 ? (balance / totalAsset) * 100 : 100;
  const lockedPercent = totalAsset > 0 ? (lockedBalance / totalAsset) * 100 : 0;

  const generateTrendPoints = () => {
    const points = [];
    const base = totalAsset || 100;
    const dailyGrowth = currentApy / 365 / 100;
    for (let i = 0; i < 7; i++) {
      const val = base * (1 - (dailyGrowth * (6 - i)) - (Math.random() * 0.001));
      points.push(val);
    }
    return points;
  };

  const trendData = generateTrendPoints();
  const maxTrend = Math.max(...trendData);
  const minTrend = Math.min(...trendData);
  const range = maxTrend - minTrend || 1;

  const svgPath = trendData.map((val, i) => {
    const x = (i / 6) * 100;
    const y = 40 - ((val - minTrend) / range) * 30;
    return `${x},${y}`;
  }).join(' ');

  const handleClaim = async () => {
    if (isClaiming || pendingInterest <= 0) return;
    setIsClaiming(true);
    await claimInterest();
    setIsClaiming(false);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    const amount = parseFloat(subAmount.replace(/,/g, ''));
    if (!amount || amount < selectedPlan.minAmount) {
      alert(`Minimum amount is ${selectedPlan.minAmount} USDT`);
      return;
    }
    if (amount > balance) {
      alert(t.insufficientForSavings);
      return;
    }
    setIsSubmitting(true);
    const success = await subscribeToPlan(selectedPlan.id, amount, autoRenew);
    setIsSubmitting(false);
    if (success) {
      alert(t.subscriptionSuccess);
      setSelectedPlan(null);
      setSubAmount('');
      setActiveTab('MY_HOLDINGS');
    }
  };

  const getEstInterest = () => {
    if (!selectedPlan) return 0;
    const amt = parseFloat(subAmount.replace(/,/g, '')) || 0;
    return (amt * (selectedPlan.apy / 100) * (selectedPlan.durationDays / 365));
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* 1. ASSET VISUALIZATION SECTION */}
      <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{t.totalAsset}</h2>
            <div className="text-3xl font-black text-white leading-none">
              {formatMoney(totalAsset)} <span className="text-xs text-slate-500 font-bold">USDT</span>
            </div>
          </div>
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#1e293b" strokeWidth="3"></circle>
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="3" strokeDasharray={`${spendablePercent} ${100 - spendablePercent}`} strokeDashoffset="0"></circle>
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f59e0b" strokeWidth="3" strokeDasharray={`${lockedPercent} ${100 - lockedPercent}`} strokeDashoffset={`-${spendablePercent}`}></circle>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-slate-800 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>7D Profit Trend</span>
            <span className="text-emerald-400">+{currentApy}% APY</span>
          </div>
          <div className="h-16 w-full relative">
            <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`M${svgPath.split(' ')[0]} L${svgPath} V40 H0 Z`} fill="url(#gradient)" />
              <polyline fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={svgPath} className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            <div>
              <p className="text-slate-500 text-[9px] font-bold uppercase">{t.availBalance}</p>
              <p className="text-white text-sm font-black">{formatMoney(balance)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
            <div>
              <p className="text-slate-500 text-[9px] font-bold uppercase">{t.lockedAsset}</p>
              <p className="text-white text-sm font-black">{formatMoney(lockedBalance)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DAILY SAVINGS */}
      {systemConfig?.interestConfig?.isEnabled && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
          </div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner border border-emerald-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="font-black text-white text-xs uppercase tracking-wider">{t.dailySavings}</h3>
                <p className="text-emerald-400 text-[10px] font-black">{t.flexible} • {currentApy}% APY</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 flex justify-between items-center border border-slate-700/50">
            <div>
              <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">{t.interestEarned}</p>
              <p className="text-white text-xl font-black tracking-tight">+{formatMoney(pendingInterest)} <span className="text-xs text-slate-500">USDT</span></p>
            </div>
            {user?.lastInterestClaimDate === new Date().toISOString().split('T')[0] ? (
              <button disabled className="bg-slate-800 text-slate-600 px-4 py-2 rounded-xl text-xs font-black border border-slate-700 uppercase tracking-widest cursor-not-allowed">
                {t.claimed}
              </button>
            ) : (
              <button
                onClick={handleClaim}
                disabled={pendingInterest <= 0 || isClaiming}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-widest active:scale-95"
              >
                {isClaiming ? '...' : t.claimInterest}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. TABS */}
      <div className="flex gap-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('MARKET')}
          className={`pb-3 font-black text-xs uppercase tracking-widest transition-all relative ${activeTab === 'MARKET' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-400'}`}
        >
          {t.savingsMarket}
          {activeTab === 'MARKET' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-400 rounded-t-full shadow-[0_-2px_10px_rgba(96,165,250,0.5)]"></div>}
        </button>
        <button
          onClick={() => setActiveTab('MY_HOLDINGS')}
          className={`pb-3 font-black text-xs uppercase tracking-widest transition-all relative ${activeTab === 'MY_HOLDINGS' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-400'}`}
        >
          {t.myHoldings}
          {activeTab === 'MY_HOLDINGS' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-400 rounded-t-full shadow-[0_-2px_10px_rgba(96,165,250,0.5)]"></div>}
        </button>
      </div>

      {/* 4. CONTENT */}
      <div className="min-h-[300px]">
        {activeTab === 'MARKET' ? (
          <div className="space-y-4">
            {savingsPlans.length === 0 ? <p className="text-center text-slate-600 py-10 italic">No plans available.</p> : (
              savingsPlans.filter(p => p.isActive).map(plan => (
                <div key={plan.id} className="bg-slate-800 rounded-2xl p-5 border border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer relative overflow-hidden group active:scale-[0.98]" onClick={() => setSelectedPlan(plan)}>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                      <h4 className="font-black text-white text-lg leading-tight mb-1">{plan.name}</h4>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-700">{plan.durationDays} {t.days}</span>
                        <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">{t.lockFunds}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-emerald-400 leading-none">{plan.apy}%</p>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">APY</p>
                    </div>
                  </div>
                  <button className="w-full bg-blue-600 group-hover:bg-blue-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/10">
                    {t.subscribe}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {userSavings.length === 0 ? <p className="text-center text-slate-600 py-10 italic">No active holdings found.</p> : (
              userSavings.map(sub => (
                <div key={sub.id} className="bg-slate-800 rounded-2xl p-5 border border-slate-700 relative">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-black text-white text-sm uppercase tracking-wider">{sub.planName}</span>
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">{t.active}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-4 text-sm">
                    <div>
                      <p className="text-slate-500 text-[10px] font-black uppercase mb-0.5">Principal</p>
                      <p className="text-white font-black">{formatMoney(sub.amount)} <span className="text-[9px] opacity-50">USDT</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[10px] font-black uppercase mb-0.5">APY</p>
                      <p className="text-emerald-400 font-black">{sub.apy}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px] font-black uppercase mb-0.5">Start Date</p>
                      <p className="text-slate-300 font-bold">{new Date(sub.startDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[10px] font-black uppercase mb-0.5">{t.maturityDate}</p>
                      <p className="text-white font-black">{new Date(sub.endDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* SUBSCRIBE MODAL */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedPlan(null)}>
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6 sm:hidden"></div>
            <h3 className="text-2xl font-black text-white mb-1 leading-tight">{t.subscribeConfirm}</h3>
            <p className="text-sm font-bold text-slate-500 mb-8 uppercase tracking-widest">{selectedPlan.name} • {selectedPlan.durationDays} {t.days} Lock</p>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Amount (Min {selectedPlan.minAmount})</label>
                  <span className="text-[10px] font-black text-slate-400">{t.availBalance}: {formatMoney(balance)}</span>
                </div>
                <div className="relative">
                  <input type="text" inputMode="decimal" value={subAmount} onChange={e => setSubAmount(formatNumber(e.target.value))} className="w-full bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 focus:border-blue-500 outline-none font-black text-2xl shadow-inner" placeholder="0.00" />
                  <span className="absolute right-4 top-5 text-slate-600 font-black text-sm">USDT</span>
                </div>
              </div>
              <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 text-xs font-black uppercase tracking-widest">{t.estInterest}</span>
                  <span className="text-white font-black text-lg">+{formatMoney(getEstInterest())} <span className="text-[10px] opacity-50">USDT</span></span>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <button onClick={() => setAutoRenew(!autoRenew)} className={`w-11 h-6 rounded-full relative transition-all duration-300 shadow-inner ${autoRenew ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md ${autoRenew ? 'left-6' : 'left-1'}`}></div>
                </button>
                <span className="text-xs text-white font-black uppercase tracking-widest">{t.autoRenew}</span>
              </div>
              <button onClick={handleSubscribe} disabled={isSubmitting || !subAmount} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 transition-all active:scale-95">
                {isSubmitting ? 'Processing...' : t.subscribe}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
