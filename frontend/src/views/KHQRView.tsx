import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { paymentApi } from '../services/api';
import { View, Currency, ParsedQR } from '../types';

interface Props {
  setView: (view: View) => void;
}

type Step = 'scan' | 'confirm' | 'pin' | 'processing' | 'result';

export const KHQRView: React.FC<Props> = ({ setView }) => {
  const { user, config, refreshUser } = useAuth();
  const [step, setStep] = useState<Step>('scan');
  const [rawQr, setRawQr] = useState('');
  const [parsed, setParsed] = useState<ParsedQR | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(Currency.USD);
  const [pin, setPin] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [txResult, setTxResult] = useState<any>(null);
  const [polling, setPolling] = useState(false);
  const scannerRef = useRef<any>(null);

  // Use Telegram QR Scanner if available
  const startScan = () => {
    if (window.Telegram?.WebApp?.showScanQrPopup) {
      window.Telegram.WebApp.showScanQrPopup(
        { text: 'Scan KHQR or VietQR code' },
        (text: string) => {
          handleQrScanned(text);
          window.Telegram?.WebApp?.closeScanQrPopup();
          return true;
        }
      );
    } else {
      // Fallback: manual input for testing
      const input = prompt('Paste QR data (for testing):');
      if (input) handleQrScanned(input);
    }
  };

  const handleQrScanned = async (data: string) => {
    setRawQr(data);
    setError('');

    const res = await paymentApi.parseQR(data);
    if (res.success && res.data) {
      setParsed(res.data);
      if (res.data.amount > 0) {
        setAmount(res.data.amount.toString());
      }
      // Set currency based on QR type
      if (res.data.type === 'VIETQR') setCurrency(Currency.VND);
      else if (res.data.type === 'KHQR') setCurrency(Currency.USD);

      setStep('confirm');
    } else {
      setError('Failed to parse QR code');
    }
  };

  const handleConfirm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setError('');
    setStep('pin');
  };

  const handlePay = async () => {
    if (pin.length < 4) {
      setError('Enter your PIN');
      return;
    }
    setError('');
    setStep('processing');

    const res = await paymentApi.payQR({
      rawQrData: rawQr,
      amount: parseFloat(amount),
      currency,
      pin,
      note: note || undefined,
    });

    if (res.success && res.data) {
      // Poll for result
      setPolling(true);
      pollStatus(res.data.transactionId);
    } else {
      setError(res.error || 'Payment failed');
      setStep('pin');
    }
  };

  const pollStatus = async (txId: string) => {
    const maxAttempts = 30; // 30 seconds
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await paymentApi.getStatus(txId);
      if (res.success && res.data) {
        const status = res.data.status;
        if (status === 'COMPLETED' || status === 'FAILED' || status === 'REJECTED') {
          setTxResult(res.data);
          setStep('result');
          setPolling(false);
          await refreshUser();
          return;
        }
      }
    }
    // Timeout
    setTxResult({ status: 'PROCESSING', description: 'Payment is still processing...' });
    setStep('result');
    setPolling(false);
  };

  const reset = () => {
    setStep('scan');
    setRawQr('');
    setParsed(null);
    setAmount('');
    setPin('');
    setNote('');
    setError('');
    setTxResult(null);
  };

  const formatMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rate = config?.exchangeRates?.[currency] || 1;
  const amountUSDT = parseFloat(amount || '0') / rate;

  return (
    <div className="px-4 py-6 animate-fade-in">
      {/* SCAN */}
      {step === 'scan' && (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-dark-700 rounded-3xl flex items-center justify-center border-2 border-dashed border-dark-600">
            <span className="text-4xl">📷</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Scan QR Code</h2>
            <p className="text-sm text-slate-400 mt-1">Supports KHQR & VietQR</p>
          </div>
          <button
            onClick={startScan}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white py-4 rounded-xl font-bold text-lg transition-all active:scale-95"
          >
            Open Scanner
          </button>
        </div>
      )}

      {/* CONFIRM */}
      {step === 'confirm' && parsed && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Payment Details</h2>

          <div className="bg-dark-700 rounded-xl p-4 border border-dark-600 space-y-3">
            <div className="flex justify-between">
              <span className="text-xs text-slate-400">QR Type</span>
              <span className="text-xs text-primary-400 font-bold">{parsed.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-400">Merchant</span>
              <span className="text-xs text-white">{parsed.merchantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-400">Bank</span>
              <span className="text-xs text-white">{parsed.bankCode || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-400">Account</span>
              <span className="text-xs text-white font-mono">{parsed.accountNumber || 'N/A'}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
            <label className="text-xs text-slate-400 block mb-2">Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-dark-900 text-white text-lg font-bold rounded-lg px-4 py-3 border border-dark-600 focus:border-primary-500 focus:outline-none"
              />
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Currency)}
                className="bg-dark-900 text-white rounded-lg px-3 border border-dark-600 focus:outline-none"
              >
                <option value="USD">USD</option>
                <option value="KHR">KHR</option>
                <option value="VND">VND</option>
              </select>
            </div>
            {currency !== Currency.USDT && parseFloat(amount) > 0 && (
              <p className="text-xs text-slate-500 mt-2">≈ {formatMoney(amountUSDT)} USDT (rate: {rate})</p>
            )}
          </div>

          {/* Note */}
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 border border-dark-600 focus:border-primary-500 focus:outline-none text-sm"
          />

          {/* Balance check */}
          {amountUSDT > (user?.balance || 0) && (
            <p className="text-xs text-red-400">⚠️ Insufficient balance ({formatMoney(user?.balance || 0)} USDT)</p>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 bg-dark-600 text-slate-300 py-3 rounded-xl font-medium">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={amountUSDT > (user?.balance || 0) || !amount}
              className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:bg-dark-600 disabled:text-slate-500 text-white py-3 rounded-xl font-bold transition-all active:scale-95"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* PIN */}
      {step === 'pin' && (
        <div className="space-y-6 text-center">
          <h2 className="text-lg font-bold text-white">Enter PIN</h2>
          <p className="text-sm text-slate-400">
            Paying <span className="text-white font-bold">{formatMoney(parseFloat(amount))} {currency}</span>
          </p>

          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="● ● ● ●"
            maxLength={6}
            autoFocus
            className="w-48 mx-auto block bg-dark-700 text-white text-2xl text-center tracking-[0.5em] rounded-xl px-4 py-4 border border-dark-600 focus:border-primary-500 focus:outline-none"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 max-w-sm mx-auto">
            <button onClick={() => { setPin(''); setStep('confirm'); }} className="flex-1 bg-dark-600 text-slate-300 py-3 rounded-xl font-medium">
              Back
            </button>
            <button
              onClick={handlePay}
              disabled={pin.length < 4}
              className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:bg-dark-600 text-white py-3 rounded-xl font-bold transition-all active:scale-95"
            >
              Confirm Payment
            </button>
          </div>
        </div>
      )}

      {/* PROCESSING */}
      {step === 'processing' && (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <h2 className="text-lg font-bold text-white">Processing Payment...</h2>
          <p className="text-sm text-slate-400">Please wait, this may take a few seconds</p>
        </div>
      )}

      {/* RESULT */}
      {step === 'result' && txResult && (
        <div className="text-center py-8 space-y-6">
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl ${
            txResult.status === 'COMPLETED' ? 'bg-primary-500/20' : 'bg-red-500/20'
          }`}>
            {txResult.status === 'COMPLETED' ? '✅' : txResult.status === 'PROCESSING' ? '⏳' : '❌'}
          </div>
          <div>
            <h2 className={`text-xl font-bold ${
              txResult.status === 'COMPLETED' ? 'text-primary-400' : 'text-red-400'
            }`}>
              {txResult.status === 'COMPLETED' ? 'Payment Successful!' : txResult.status === 'PROCESSING' ? 'Still Processing' : 'Payment Failed'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">{txResult.description}</p>
          </div>

          <button
            onClick={reset}
            className="w-full max-w-xs mx-auto bg-dark-700 hover:bg-dark-600 text-white py-3 rounded-xl font-medium transition-all"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};
