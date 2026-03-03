import React, { useState, useEffect } from 'react';
import { Currency, Transaction, Language, View } from '../types';
import { TRANSLATIONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { formatNumber, formatMoney } from '../utils/format';
import { IconShield } from '../components/Icons';

interface HomeViewProps {
  lang: Language;
  setView: (view: View) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ lang, setView }) => {
  const { user, config, refreshUser } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isDepositModalOpen, setDepositModalOpen] = useState(false);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [walletRes, txRes] = await Promise.all([
      userApi.getWallet(),
      userApi.getTransactions(20),
    ]);
    if (walletRes.success) setWallet(walletRes.data);
    if (txRes.success) setTransactions(txRes.data || []);
  };

  const usdtBalance = user?.balance || 0;
  const today = new Date().toISOString().split('T')[0];
  const hasClaimedToday = user?.lastInterestClaimDate === today;

  const khrRate = config?.exchangeRates?.[Currency.KHR] || 4100;
  const usdRate = config?.exchangeRates?.[Currency.USD] || 1.0;
  const khrEquivalent = usdtBalance * khrRate;
  const usdEquivalent = usdtBalance * usdRate;
  const userWalletAddress = user?.customDepositAddress || user?.walletAddress || wallet?.address || "Loading...";

  // Calculate interest
  const calculateInterest = () => {
    if (!user || !config?.interestConfig) return { interest: 0, apy: 0 };
    const ic = config.interestConfig;
    if (!ic.isEnabled || usdtBalance < ic.minBalanceToEarn) return { interest: 0, apy: 0 };
    let apy = 0;
    for (const tier of ic.tiers) {
      if (usdtBalance >= tier.minBalance && usdtBalance < tier.maxBalance) {
        apy = tier.apy;
        break;
      }
    }
    const interest = Math.min((usdtBalance * (apy / 100)) / 365, ic.dailyPayoutCap);
    return { interest, apy };
  };

  const { interest: pendingInterest, apy: currentApy } = calculateInterest();

  const handleCopy = () => {
    navigator.clipboard.writeText(userWalletAddress);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleQuickClaim = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isClaiming || hasClaimedToday || pendingInterest <= 0) return;
    setIsClaiming(true);
    try {
      await userApi.claimInterest();
      await refreshUser();
      await loadData();
    } catch (err) { console.error(err); }
    finally { setIsClaiming(false); }
  };

  const handleSubmitDeposit = async () => {
    const rawVal = parseFloat(depositAmount.replace(/,/g, ''));
    if (!rawVal || rawVal <= 0) { alert(t.validAmount); return; }
    setIsSubmitting(true);
    const res = await userApi.requestDeposit(rawVal);
    setIsSubmitting(false);
    if (res.success) {
      alert(t.depositSent);
      setDepositModalOpen(false);
      setDepositAmount('');
      await loadData();
    }
  };

  const qrUrl = `https://quickchart.io/qr?text=${userWalletAddress}&size=300&ecLevel=M&margin=1&format=png`;

  const getTxTypeInfo = (tx: Transaction) => {
    const isIncoming = tx.type === 'DEPOSIT' || tx.type === 'INTEREST' || (tx.type === 'ADJUSTMENT' && (tx.afterBalance || 0) > (tx.beforeBalance || 0));
    const isPayment = tx.type === 'PAYMENT' || tx.type === 'KHQR_SCAN' || tx.type === 'SAVINGS_LOCK';
    const isRejected = tx.status === 'REJECTED' || tx.status === 'FAILED';
    return { isIncoming, isPayment, isInterest: tx.type === 'INTEREST', isSavingsLock: tx.type === 'SAVINGS_LOCK', isRejected };
  };

  const getTxDescription = (tx: Transaction) => {
    if (tx.type === 'DEPOSIT') return t.typeDeposit;
    if (tx.type === 'INTEREST') return t.typeInterest;
    if (tx.type === 'SAVINGS_LOCK') return t.typeSavingsLock;
    if (tx.type === 'SAVINGS_REDEEM') return t.typeSavingsRedeem;
    if (tx.type === 'PAYMENT' || tx.type === 'KHQR_SCAN') {
      return tx.merchantName && tx.merchantName !== 'Unknown' ? tx.merchantName : t.typePayment;
    }
    return tx.merchantName || tx.description || t.typePayment;
  };

  const getTxStatus = (status: string) => {
    switch(status) {
      case 'COMPLETED': return t.statusCompleted;
      case 'PENDING_APPROVAL': return t.statusPending;
      case 'QUEUED_FOR_BOT': return t.statusPending;
      case 'PROCESSING': return t.statusProcessing;
      case 'FAILED': return t.statusFailed;
      case 'REJECTED': return t.statusRejected;
      default: return status;
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* BALANCE CARD - GREEN THEME */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl shadow-lg shadow-emerald-900/40 text-white relative overflow-hidden transition-all duration-300 border border-emerald-500/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
        <div className="p-6 relative z-10">
          <p className="text-emerald-100 text-sm font-medium mb-1 tracking-wide">{t.availBalance}</p>
          <h2 className="text-4xl font-bold tracking-tight flex items-baseline gap-1">
            {usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xl font-medium text-emerald-200">USDT</span>
          </h2>
          <div className="mt-3 flex items-center gap-2 text-emerald-100/90 font-medium text-sm">
             <span className="bg-black/20 px-2 py-0.5 rounded text-xs backdrop-blur-sm border border-white/10">{t.approx}</span>
             <span className="opacity-90">${usdEquivalent.toLocaleString('en-US', { maximumFractionDigits: 2 })} • {khrEquivalent.toLocaleString('en-US', { maximumFractionDigits: 0 })} KHR</span>
          </div>
        </div>
      </div>

      {/* QUICK EARN WIDGET */}
      {config?.interestConfig?.isEnabled && (
        <div onClick={() => setView(View.EARN)} className="bg-slate-800 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between hover:bg-slate-750 transition-colors cursor-pointer group shadow-sm">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform border border-emerald-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
             </div>
             <div>
                <div className="flex items-center gap-1.5">
                   <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{t.apy}</span>
                   <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-1.5 py-0.5 rounded font-black border border-emerald-500/20">{currentApy}%</span>
                </div>
                <p className="text-slate-200 text-sm font-bold">+{formatMoney(pendingInterest)} <span className="text-[10px] text-slate-500">USDT</span></p>
             </div>
          </div>
          <button 
            type="button"
            onClick={handleQuickClaim}
            disabled={isClaiming || hasClaimedToday || pendingInterest <= 0}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all border ${
              (!hasClaimedToday && pendingInterest > 0) 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-900/20 active:scale-95' 
              : 'bg-slate-700/50 text-slate-500 border-slate-600 cursor-not-allowed opacity-60'
            }`}
          >
            {isClaiming ? '...' : (hasClaimedToday ? t.claimed : t.claimInterest)}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setDepositModalOpen(true)} className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 py-3 px-2 rounded-xl font-bold flex flex-row items-center justify-center gap-2 border border-slate-700/60 shadow-sm h-14 group">
          <svg className="w-5 h-5 text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="truncate group-hover:text-white transition-colors">{t.deposit}</span>
        </button>
        <button onClick={() => setView(View.KHQR)} className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 py-3 px-2 rounded-xl font-bold flex flex-row items-center justify-center gap-2 border border-slate-700/60 shadow-sm h-14 group">
          <svg className="w-5 h-5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 6h2v2H6V6zm0 10h2v2H6v-2zM6 16h6M16 6h2v2h-2V6z" /></svg>
          <span className="truncate group-hover:text-white transition-colors">{t.withdraw}</span>
        </button>
      </div>

      {/* Recent Transactions */}
      <div>
        <h3 className="text-slate-500 text-[10px] font-black mb-3 uppercase tracking-[0.2em] px-1">{t.recentTx}</h3>
        {transactions.length === 0 ? (
            <div className="text-center text-slate-600 py-12 text-sm italic bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">{t.noTx}</div>
        ) : (
            <div className="space-y-3">
            {transactions.map((tx) => {
                const { isIncoming, isPayment, isRejected } = getTxTypeInfo(tx);
                return (
                    <button key={tx.id} onClick={() => setSelectedTx(tx)} className="w-full bg-slate-800/40 hover:bg-slate-800 rounded-xl p-4 flex justify-between items-center border border-slate-700/40 hover:border-slate-600 transition-all active:scale-[0.99] group">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                            isRejected ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                            isIncoming ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                            {isIncoming ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg> : 
                             isPayment ? <div className="w-5 h-5"><IconShield /></div> : 
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>}
                        </div>
                        <div className="text-left">
                        <p className={`font-bold text-sm leading-tight ${isRejected ? 'text-slate-400 line-through' : 'text-slate-200 group-hover:text-white'}`}>{getTxDescription(tx)}</p>
                        <p className="text-slate-500 text-[10px] font-mono mt-1">{tx.date}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`font-bold ${isRejected ? 'text-slate-500' : isIncoming ? 'text-emerald-500' : 'text-slate-200'}`}>{isIncoming ? '+' : '-'}{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                    </button>
                );
            })}
            </div>
        )}
      </div>

      {/* Deposit Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 animate-slide-up shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">{t.depositTitle}</h3>
              <button onClick={() => setDepositModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="flex flex-col items-center mb-4">
                <div className="bg-white p-2 rounded-xl mb-4 shadow-xl">
                    <img src={qrUrl} alt="Wallet QR" className="rounded w-40 h-40 object-contain block bg-white" />
                </div>
                <p className="text-slate-400 text-sm text-center mb-2">{t.depositInstruct}</p>
                <div className="w-full bg-slate-800 rounded-lg p-3 flex items-center justify-between border border-slate-700 mb-6 shadow-inner">
                    <span className="text-slate-300 text-xs truncate mr-2 font-mono">{userWalletAddress}</span>
                    <button onClick={handleCopy} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap shadow-lg">{copySuccess ? t.copied : t.copy}</button>
                </div>
                <div className="w-full border-t border-slate-800 pt-4">
                    <label className="text-slate-300 text-sm block mb-2 font-bold uppercase tracking-wider">{t.confirmTransfer}</label>
                    <div className="relative mb-4">
                        <input type="text" inputMode="decimal" value={depositAmount} onChange={(e) => setDepositAmount(formatNumber(e.target.value))} placeholder={t.amountPlaceholder} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 font-bold tracking-wide transition-colors" />
                        <span className="absolute right-4 top-3 text-slate-500 font-bold">USDT</span>
                    </div>
                </div>
            </div>
            <button onClick={handleSubmitDeposit} disabled={isSubmitting || !depositAmount} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-black transition-all shadow-lg shadow-emerald-900/20 active:scale-95 flex justify-center items-center">
                {isSubmitting ? '...' : t.iHaveTransferred}
            </button>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedTx(null)}>
              <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setSelectedTx(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                  
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-inner">
                          {selectedTx.type === 'DEPOSIT' || selectedTx.type === 'INTEREST' ? (
                              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                          ) : (
                              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                          )}
                      </div>
                      <h3 className="text-white font-bold text-lg mb-1">{getTxDescription(selectedTx)}</h3>
                      <p className={`text-3xl font-black ${selectedTx.status === 'FAILED' || selectedTx.status === 'REJECTED' ? 'text-red-500 line-through' : (selectedTx.type === 'DEPOSIT' || selectedTx.type === 'INTEREST') ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {(selectedTx.type === 'DEPOSIT' || selectedTx.type === 'INTEREST') ? '+' : '-'}{formatMoney(selectedTx.amount)} USDT
                      </p>
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold mt-2 ${
                          selectedTx.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                          selectedTx.status === 'PENDING_APPROVAL' || selectedTx.status === 'PROCESSING' ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-red-500/20 text-red-500'
                      }`}>
                          {getTxStatus(selectedTx.status)}
                      </span>
                  </div>

                  <div className="space-y-4 text-sm border-t border-slate-800 pt-4">
                      <div className="flex justify-between">
                          <span className="text-slate-500">{t.time}</span>
                          <span className="text-white font-mono text-xs">{selectedTx.date}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-slate-500">{t.txnId}</span>
                          <span className="text-white font-mono text-xs truncate max-w-[150px]">{selectedTx.partnerSrcId || selectedTx.id}</span>
                      </div>
                      {selectedTx.merchantName && (
                          <div className="flex justify-between">
                              <span className="text-slate-500">{t.recipient}</span>
                              <span className="text-white font-bold text-right max-w-[180px] break-words">{selectedTx.merchantName}</span>
                          </div>
                      )}
                      {selectedTx.bankName && (
                          <div className="flex justify-between">
                              <span className="text-slate-500">{t.bank}</span>
                              <span className="text-white font-bold">{selectedTx.bankName}</span>
                          </div>
                      )}
                      {selectedTx.description && selectedTx.type === 'KHQR_SCAN' && (
                          <div className="flex justify-between flex-col gap-1">
                              <span className="text-slate-500">{t.transactionNote}</span>
                              <span className="text-slate-300 bg-slate-800 p-2 rounded text-xs">{selectedTx.description}</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
