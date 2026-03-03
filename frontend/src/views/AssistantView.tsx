import React, { useState, useRef, useEffect } from 'react';
import { askAssistant } from '../services/geminiService';
import { Currency, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { formatMoney } from '../utils/format';

interface AssistantViewProps {
  lang: Language;
}

export const AssistantView: React.FC<AssistantViewProps> = ({ lang }) => {
  const { user, config } = useAuth();
  const t = TRANSLATIONS[lang];

  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    {role: 'model', text: t.assistantIntro}
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const triggerPrompt = sessionStorage.getItem('assistant_trigger');
    if (triggerPrompt) {
        sessionStorage.removeItem('assistant_trigger');
        handleSend(triggerPrompt);
    } else {
         setMessages(prev => {
            if (prev.length === 1 && prev[0].role === 'model') {
                return [{role: 'model', text: t.assistantIntro}];
            }
            return prev;
        });
    }
  }, [lang, t.assistantIntro]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async (manualInput?: string) => {
    const textToSend = manualInput || input;
    if (!textToSend.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    if (!manualInput) setInput('');
    setIsLoading(true);

    const usdtBalance = user?.balance || 0;
    const khrRate = config?.exchangeRates?.[Currency.KHR] || 4100;
    const usdRate = config?.exchangeRates?.[Currency.USD] || 1.0;
    
    const tiers = config?.interestConfig?.tiers || [];
    const tiersText = tiers.map(t => `   - Balance ${t.minBalance}-${t.maxBalance} USDT: ${t.apy}% APY`).join('\n');

    // Calculate current APY
    let currentApy = 0;
    for (const tier of tiers) {
      if (usdtBalance >= tier.minBalance && usdtBalance < tier.maxBalance) {
        currentApy = tier.apy;
        break;
      }
    }
    const pendingInterest = config?.interestConfig?.isEnabled 
      ? Math.min((usdtBalance * (currentApy / 100)) / 365, config.interestConfig.dailyPayoutCap)
      : 0;

    const context = `
      Current Language: ${lang === 'vi' ? 'Vietnamese' : lang === 'zh' ? 'Chinese' : lang === 'km' ? 'Khmer' : 'English'}.
      
      User Profile:
      - Wallet ID: ${user?.id}
      - Available Balance: ${usdtBalance} USDT
      
      Exchange Rates:
      - 1 USDT = ${khrRate} KHR
      - 1 USDT = ${usdRate} USD
      
      SAVINGS PRODUCTS:
      
      1. Flexible Savings (Daily Interest):
         - Current APY for User: ${currentApy}%
         - Pending Interest to Claim Today: ${pendingInterest} USDT
         - Tiers Structure:
${tiersText}
      
      App Functionality: 
      - Deposit USDT (TRC20 network only).
      - Pay via KHQR (Scans Cambodia KHQR, auto-converts USDT).
      - Earn (Savings & Investment).
    `;

    const response = await askAssistant(textToSend, context, config?.geminiApiKey);
    
    setMessages(prev => [...prev, { role: 'model', text: response }]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* HEADER */}
      <div className="bg-slate-900 p-4 border-b border-slate-800 shadow-xl z-10 flex flex-col items-center justify-center space-y-2">
          <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-1 shadow-inner border border-slate-700">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-bold mb-0.5">{t.yourId}</p>
              <div className="bg-slate-800 px-3 py-0.5 rounded border border-slate-700">
                   <span className="text-white font-mono font-bold text-sm tracking-widest">{user?.id}</span>
              </div>
          </div>
          {config?.telegramSupportUrl && (
              <a
                  href={config.telegramSupportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold text-xs shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-1.5"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  {t.contactSupport}
              </a>
          )}
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-slate-700 flex gap-2">
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.assistantPlaceholder}
            className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 outline-none border border-slate-700 focus:border-blue-500 transition-colors shadow-inner"
          />
          <button 
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-3 rounded-xl transition-colors shadow-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};
