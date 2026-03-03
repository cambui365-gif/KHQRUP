import React, { useState, useEffect, useRef } from 'react';
import { Currency, Language, Transaction, View } from '../types';
import { TRANSLATIONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { paymentApi, userApi } from '../services/api';
import { parseKHQR, KHQRData } from '../services/khqrUtils';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import html2canvas from "html2canvas";
import { formatNumber } from '../utils/format';
import { IconShield } from '../components/Icons';

interface KHQRViewProps {
  lang: Language;
  setView: (view: View) => void;
}

export const KHQRView: React.FC<KHQRViewProps> = ({ lang, setView }) => {
  const { user, config, refreshUser } = useAuth();
  const usdtBalance = user?.balance || 0;
  const t = TRANSLATIONS[lang];
  
  const [step, setStep] = useState<'SCANNING' | 'CONFIRM' | 'CREATE_PIN' | 'CONFIRM_NEW_PIN' | 'PIN' | 'PROCESSING' | 'INVOICE'>('SCANNING');
  const [scannedData, setScannedData] = useState<KHQRData | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.KHR);
  const [inputAmount, setInputAmount] = useState<string>(''); 
  const [pin, setPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [userNote, setUserNote] = useState<string>('');
  const [resultTx, setResultTx] = useState<Transaction | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [isTelegramEnv, setIsTelegramEnv] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [generatedBillImage, setGeneratedBillImage] = useState<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const [isShaking, setIsShaking] = useState(false);

  const getRawAmount = () => parseFloat(inputAmount.replace(/,/g, '')) || 0;

  useEffect(() => {
      if (pin.length === 6) {
          if (step === 'PIN') handlePaymentSubmit();
          else if (step === 'CREATE_PIN') handleCreatePin();
          else if (step === 'CONFIRM_NEW_PIN') handleConfirmNewPin();
      }
  }, [pin, step]);

  useEffect(() => {
      if ((step === 'PIN' || step === 'CREATE_PIN' || step === 'CONFIRM_NEW_PIN') && pinInputRef.current) pinInputRef.current.focus();
  }, [step]);

  useEffect(() => {
    if (window.Telegram?.WebApp?.initData) setIsTelegramEnv(true);
    if (step === 'SCANNING') {
        const initScanner = async () => {
             if (window.Telegram?.WebApp?.showScanQrPopup) {
                 window.Telegram.WebApp.showScanQrPopup({ text: t.scanQr }, (text) => {
                     if (text) { handleScanSuccess(text); return true; }
                 });
                 return;
             }
             if (scannerRef.current) {
                 try { await scannerRef.current.stop(); } catch(e) {}
                 try { await scannerRef.current.clear(); } catch(e) {}
                 scannerRef.current = null;
             }
             const scanner = new Html5Qrcode("reader-camera", { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
             scannerRef.current = scanner;
             try {
                 await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, (decodedText) => handleScanSuccess(decodedText), () => { });
                 setIsCameraRunning(true);
             } catch (err) { setIsCameraRunning(false); }
        };
        setTimeout(initScanner, 100);
        return () => {
            if (scannerRef.current?.isScanning) { try { scannerRef.current.stop(); } catch(e) {} }
            if (window.Telegram?.WebApp?.closeScanQrPopup) window.Telegram.WebApp.closeScanQrPopup();
        };
    }
  }, [step, cameraVersion]);

  const handleScanSuccess = (decodedText: string) => {
      const data = parseKHQR(decodedText);
      const stopCamera = () => {
        if (scannerRef.current?.isScanning) { try { scannerRef.current.stop(); scannerRef.current.clear(); } catch(e) {} setIsCameraRunning(false); }
      };
      if (!data.isValid) { stopCamera(); alert(t.invalidKHQR); setCameraVersion(prev => prev + 1); return; }
      if (data.isVietQR) { stopCamera(); alert(t.vietqrMaintenance); setCameraVersion(prev => prev + 1); return; }
      stopCamera();
      setScannedData(data);
      if (data.amount && data.isFixedAmount) { setInputAmount(formatNumber(data.amount.toString())); setSelectedCurrency(data.currency); } else { setInputAmount(''); setSelectedCurrency(data.currency); }
      setUserNote(''); setStep('CONFIRM');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      if (scannerRef.current && isCameraRunning) {
          try { await scannerRef.current.stop(); await scannerRef.current.clear(); setIsCameraRunning(false); scannerRef.current = null; } catch (err) {}
      }
      let fileScanner: Html5Qrcode | null = null;
      try {
          fileScanner = new Html5Qrcode("reader-file-upload", { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
          const decodedText = await fileScanner.scanFile(file, true);
          handleScanSuccess(decodedText);
      } catch (err) { alert(t.cannotScanImg); setCameraVersion(prev => prev + 1); } 
      finally { if (fileScanner) try { await fileScanner.clear(); } catch(e) {} }
  };

  const billCurrency = selectedCurrency;
  const finalAmount = getRawAmount();
  const conversionRate = config?.exchangeRates?.[billCurrency] || 1;
  const equivalentUSDT = finalAmount / conversionRate;
  const insufficientBalance = equivalentUSDT > usdtBalance;

  const handleStartPayment = () => {
    if (billCurrency === Currency.KHR && finalAmount < 1000) return alert(t.minPaymentKHR);
    if (billCurrency === Currency.USD && finalAmount < 0.2) return alert(t.minPaymentUSD);
    if (finalAmount <= 0) return alert(t.enterAmount);
    if (insufficientBalance) return handleDepositRedirect();
    if (!user?.pinHash && !user?.hasPin) { setStep('CREATE_PIN'); setPin(''); setNewPin(''); } else { setStep('PIN'); setPin(''); }
  };

  const handleCreatePin = () => { setNewPin(pin); setPin(''); setStep('CONFIRM_NEW_PIN'); };
  const handleConfirmNewPin = async () => {
      if (pin !== newPin) { setIsShaking(true); setTimeout(() => setIsShaking(false), 500); alert(t.pinMismatch); setPin(''); setNewPin(''); setStep('CREATE_PIN'); return; }
      await userApi.setPin(pin);
      alert(t.pinSetSuccess);
      await refreshUser();
      setStep('PIN'); setPin('');
  };
  const handleDepositRedirect = () => { setView(View.HOME); };

  const handlePaymentSubmit = async () => {
    setStep('PROCESSING'); 
    
    const paymentPromise = paymentApi.payQR({
      rawQrData: scannedData?.raw || '',
      amount: finalAmount,
      currency: billCurrency,
      pin: pin,
      note: userNote || undefined,
    });
    
    const delayPromise = new Promise(resolve => setTimeout(resolve, 6000));
    const [result] = await Promise.all([paymentPromise, delayPromise]);

    if (result.success && result.data) {
        // Poll for final status
        const txId = result.data.transactionId;
        let finalTx: any = null;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const statusRes = await paymentApi.getStatus(txId);
          if (statusRes.success && statusRes.data) {
            const s = statusRes.data.status;
            if (s === 'COMPLETED' || s === 'FAILED' || s === 'REJECTED') {
              finalTx = statusRes.data;
              break;
            }
          }
        }
        if (finalTx && finalTx.status === 'COMPLETED') {
          setResultTx(finalTx);
          setStep('INVOICE');
          await refreshUser();
        } else {
          alert(finalTx?.description || 'Payment processing timeout');
          setStep('PIN'); setPin('');
        }
    } else { 
        const errMsg = result.error || "Failed";
        if (errMsg.includes('PIN') || errMsg.includes('pin')) {
          setStep('PIN'); setPin(''); setIsShaking(true); setTimeout(() => setIsShaking(false), 500);
          alert(errMsg);
        } else {
          alert(errMsg); setStep('PIN'); setPin('');
        }
    }
  };

  const handleGenerateAndShareBill = async () => {
      if (!invoiceRef.current) return;
      setIsSharing(true);
      try {
          const canvas = await html2canvas(invoiceRef.current, { scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false });
          canvas.toBlob(async (blob) => {
              if (!blob) { setIsSharing(false); return; }
              const file = new File([blob], `receipt_${resultTx?.id}.png`, { type: "image/png" });
              const dataUrl = canvas.toDataURL("image/png");
              setGeneratedBillImage(dataUrl);
              if (navigator.share && navigator.canShare({ files: [file] })) { try { await navigator.share({ title: 'Receipt', files: [file] }); } catch (error) {} }
              setIsSharing(false);
          }, 'image/png');
      } catch (e) { setIsSharing(false); }
  };

  // === SCANNING STEP ===
  if (step === 'SCANNING') {
      return (
        <div className="flex flex-col h-full min-h-[calc(100vh-80px)] p-4 relative">
           <h2 className="text-xl font-bold text-center mb-6 text-white">{t.scanQr}</h2>
           <div className="flex-1 flex flex-col items-center justify-start">
                {isTelegramEnv ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-slate-800 rounded-2xl border border-dashed border-slate-700 w-full max-w-sm aspect-square text-center">
                        <svg className="w-16 h-16 text-emerald-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 6h2v2H6V6zm0 10h2v2H6v-2zM6 16h6M16 6h2v2h-2V6z" /></svg>
                        <p className="text-white font-bold mb-2">{t.camTelegram}</p>
                        <button onClick={() => window.location.reload()} className="mt-4 text-emerald-500 text-sm font-semibold underline">{t.retry}</button>
                    </div>
                ) : (
                    <div className="relative w-full max-w-sm aspect-square bg-black rounded-3xl overflow-hidden border-2 border-emerald-500 shadow-2xl">
                        <div id="reader-camera" className="w-full h-full"></div>
                        {isCameraRunning && <><div className="absolute inset-0 border-[40px] border-black/50 z-10 pointer-events-none"></div><div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"><div className="w-64 h-64 border-2 border-emerald-500 relative"><div className="absolute inset-0 border-t-2 border-emerald-500 animate-scan"></div></div></div></>}
                    </div>
                )}
                <div id="reader-file-upload" style={{ display: 'none' }}></div>
                <div className="mt-8 w-full max-w-xs space-y-4">
                     <div className="relative">
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onClick={(e) => (e.target as HTMLInputElement).value = ''} />
                        <button className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>{t.uploadImage}
                        </button>
                     </div>
                </div>
           </div>
        </div>
      );
  }

  // === PIN STEPS ===
  if (step === 'PIN' || step === 'CREATE_PIN' || step === 'CONFIRM_NEW_PIN') {
      const isConfirm = step === 'CONFIRM_NEW_PIN'; const isCreate = step === 'CREATE_PIN';
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
            <style>{`@keyframes shake {0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-5px)}20%,40%,60%,80%{transform:translateX(5px)}}.shake-animation{animation:shake 0.4s cubic-bezier(.36,.07,.19,.97) both}`}</style>
            <div className={`w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl ${isShaking ? 'shake-animation border-red-500' : ''}`}>
                <h3 className="text-xl font-bold text-white mb-2">{step === 'PIN' ? t.enterPin : (isConfirm ? t.confirmNewPin : t.createPin)}</h3>
                <input ref={pinInputRef} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} placeholder="******" autoFocus className={`w-full bg-slate-800 text-center text-3xl tracking-widest text-white border rounded-xl py-4 mb-8 focus:border-emerald-500 outline-none transition-colors ${isShaking ? 'border-red-500 text-red-500' : 'border-slate-700'}`} />
                <button onClick={() => { if(isCreate) { setStep('SCANNING'); setPin(''); } else if(isConfirm) { setStep('CREATE_PIN'); setPin(''); setNewPin(''); } else { setStep('CONFIRM'); } }} className="bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-semibold w-full border border-slate-700">{t.cancel}</button>
            </div>
        </div>
      );
  }

  // === PROCESSING ===
  if (step === 'PROCESSING') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md p-4 animate-fade-in">
        <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 bg-emerald-500 rounded-full opacity-20 animate-ping"></div>
            <div className="absolute inset-2 bg-emerald-500 rounded-full opacity-40 animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-slate-900 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
                <IconShield className="w-8 h-8 text-emerald-500" />
            </div>
        </div>
        <h3 className="text-xl font-bold text-white mb-2 animate-pulse">{t.processing}</h3>
        <p className="text-slate-400 text-xs">{t.doNotClose}</p>
    </div>
  );

  // === INVOICE ===
  if (step === 'INVOICE' && resultTx) {
      const mainAmount = resultTx.originalAmount ? resultTx.originalAmount : resultTx.amount;
      const mainCurrency = resultTx.originalCurrency ? resultTx.originalCurrency : Currency.USDT;
      const displayBank = resultTx.bankName || scannedData?.bankName || "Unknown Bank";
      
      return (
        <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col items-center justify-center p-4 animate-slide-up overflow-y-auto">
            {generatedBillImage ? (
                <div className="w-full max-w-sm flex flex-col items-center">
                    <img src={generatedBillImage} alt="Receipt" className="w-full rounded-2xl shadow-2xl border border-slate-700" />
                    <div className="w-full mt-6 space-y-3">
                        <button onClick={() => { const link = document.createElement('a'); link.download = `receipt_${resultTx?.id}.png`; link.href = generatedBillImage; link.click(); }} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold">Save Image</button>
                        <button onClick={() => setView(View.HOME)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold">{t.done}</button>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-sm relative pb-8">
                    <div ref={invoiceRef} className="bg-white text-slate-900 overflow-hidden shadow-2xl relative w-full font-sans">
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0 overflow-hidden">
                             <div className="transform -rotate-45 font-black text-9xl whitespace-nowrap">365 WALLET</div>
                        </div>
                        <div className="bg-emerald-600 p-6 text-center text-white relative z-10">
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h2 className="text-lg font-bold tracking-wide uppercase">{t.invoiceHeader}</h2>
                            <p className="text-emerald-100 text-xs mt-1">{resultTx.date}</p>
                        </div>
                        <div className="p-6 relative z-10 bg-emerald-50/50 border-b border-dashed border-slate-300">
                            <p className="text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{t.totalPayment}</p>
                            <div className="text-center text-4xl font-black text-slate-800 tracking-tighter">
                                -{mainAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-xl text-slate-500">{mainCurrency}</span>
                            </div>
                        </div>
                        <div className="p-6 relative z-10 bg-white">
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between items-start">
                                    <span className="text-slate-500 text-xs font-bold uppercase">{t.txnId}</span>
                                    <span className="text-slate-800 font-mono font-bold text-right text-xs break-all max-w-[150px]">{resultTx.partnerSrcId || resultTx.id}</span>
                                </div>
                                <div className="w-full border-t border-dashed border-slate-200"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 text-xs font-bold uppercase">{t.sourceFunds}</span>
                                    <div className="text-right">
                                        <div className="text-slate-900 font-bold text-xs">{t.myWallet}</div>
                                        <div className="text-slate-400 text-[10px]">365 Wallet</div>
                                    </div>
                                </div>
                                <div className="w-full border-t border-dashed border-slate-200"></div>
                                <div className="flex justify-between items-start">
                                    <span className="text-slate-500 text-xs font-bold uppercase mt-1">{t.recipient}</span>
                                    <div className="text-right max-w-[60%]">
                                        <div className="text-slate-900 font-bold uppercase leading-tight">{resultTx.merchantName}</div>
                                        <div className="text-slate-500 text-[10px] mt-0.5">{scannedData?.merchantCity}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-white rounded flex items-center justify-center border border-slate-200 font-bold text-xs text-blue-600 shadow-sm">
                                            {displayBank.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-slate-800 font-bold text-xs">{displayBank}</div>
                                            <div className="text-slate-500 text-[10px] font-mono">{resultTx.recipientAccount}</div>
                                        </div>
                                    </div>
                                </div>
                                {resultTx.description && (
                                    <div className="pt-2">
                                        <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">{t.description}</p>
                                        <p className="text-slate-800 text-xs bg-yellow-50 p-2 rounded border border-yellow-100 italic">{resultTx.description}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="w-full h-4 bg-white relative z-10" style={{
                            backgroundImage: 'linear-gradient(45deg, transparent 75%, #0f172a 75%), linear-gradient(-45deg, transparent 75%, #0f172a 75%)',
                            backgroundSize: '16px 16px',
                            backgroundPosition: '0 0'
                        }}></div>
                    </div>
                    <div className="mt-8 space-y-3">
                        <button onClick={handleGenerateAndShareBill} disabled={isSharing} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold border border-slate-700 shadow-lg active:scale-95 transition-all">{isSharing ? 'Generating...' : t.shareBill}</button>
                        <button onClick={() => setView(View.HOME)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">{t.done}</button>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // === CONFIRM STEP ===
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-80px)] p-4">
        <div className="flex-1 max-w-sm mx-auto w-full pt-8 flex items-center">
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl w-full transition-all duration-300">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-2xl shadow-lg">{scannedData?.merchantName.charAt(0)}</div>
                    <h2 className="text-xl font-bold text-white">{scannedData?.merchantName}</h2>
                </div>
                {!scannedData?.isFixedAmount && (
                    <div className="flex bg-slate-800 rounded-xl p-1 mb-6 border border-slate-700">
                        <button onClick={() => setSelectedCurrency(Currency.KHR)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${selectedCurrency === Currency.KHR ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>KHR (៛)</button>
                        <button onClick={() => setSelectedCurrency(Currency.USD)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${selectedCurrency === Currency.USD ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>USD ($)</button>
                    </div>
                )}
                <div className="space-y-4 mb-6">
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-inner text-center">
                        <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-2">{t.enterAmount} ({billCurrency})</label>
                        {scannedData?.amount && scannedData.isFixedAmount ? (
                            <div className="text-white font-black text-4xl">{scannedData.amount.toLocaleString()}</div>
                        ) : (
                            <input type="text" inputMode="decimal" pattern="^[0-9]*[.,]?[0-9]*$" value={inputAmount} onChange={(e) => setInputAmount(formatNumber(e.target.value))} placeholder="0" autoFocus className="w-full bg-transparent text-5xl font-black text-emerald-500 outline-none placeholder-slate-700 text-center" />
                        )}
                    </div>
                    <div>
                         <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1.5 ml-1">{t.transactionNote}</label>
                         <input type="text" value={userNote} onChange={(e) => setUserNote(e.target.value)} placeholder={t.notePlaceholder} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-white outline-none text-sm focus:border-emerald-500 transition-colors" />
                    </div>
                    <div className="flex justify-between items-center py-2 pt-4 border-t border-slate-800"><span className="text-slate-400">{t.payWith}</span><span className={`font-bold text-xl ${insufficientBalance ? 'text-red-500' : 'text-emerald-500'}`}>{equivalentUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT</span></div>
                </div>
                {insufficientBalance && <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-3 rounded-xl text-center text-sm mb-4"><span>{t.insufficient}</span><button onClick={handleDepositRedirect} className="font-bold underline text-red-300 ml-2">{t.depositNow}</button></div>}
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setStep('SCANNING')} className="bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-semibold border border-slate-700">{t.cancel}</button>
                    <button onClick={handleStartPayment} disabled={insufficientBalance || finalAmount <= 0} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20">{t.pay}</button>
                </div>
            </div>
        </div>
    </div>
  );
};
