import React, { useState, useRef, useEffect } from 'react';
import { Currency, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';

interface AssistantViewProps {
  lang: Language;
}

export const AssistantView: React.FC<AssistantViewProps> = ({ lang }) => {
  const { user, config: systemConfig, currentApy, pendingInterest, savingsPlans, userSavings } = useAuth();
  const usdtBalance = user?.balance || 0;
  const t = TRANSLATIONS[lang];

  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: t.assistantIntro }
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
          return [{ role: 'model', text: t.assistantIntro }];
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

    // Simple local response for now (no Gemini dependency)
    // In production, this would call a backend AI endpoint
    const response = generateLocalResponse(textToSend, lang);
    
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'model', text: response }]);
      setIsLoading(false);
    }, 800);
  };

  const generateLocalResponse = (query: string, lang: Language): string => {
    const q = query.toLowerCase();
    const khrRate = systemConfig?.exchangeRates?.[Currency.KHR] || 4100;
    
    if (q.includes('balance') || q.includes('số dư') || q.includes('余额') || q.includes('សមតុល្យ')) {
      return lang === 'vi' ? `Số dư hiện tại của bạn: ${usdtBalance} USDT (≈ ${(usdtBalance * khrRate).toLocaleString()} KHR)` :
             lang === 'zh' ? `您的当前余额: ${usdtBalance} USDT (≈ ${(usdtBalance * khrRate).toLocaleString()} KHR)` :
             `Your current balance: ${usdtBalance} USDT (≈ ${(usdtBalance * khrRate).toLocaleString()} KHR)`;
    }
    if (q.includes('rate') || q.includes('tỷ giá') || q.includes('汇率') || q.includes('អត្រា')) {
      return lang === 'vi' ? `Tỷ giá hiện tại: 1 USDT = ${khrRate} KHR` :
             lang === 'zh' ? `当前汇率: 1 USDT = ${khrRate} KHR` :
             `Current rate: 1 USDT = ${khrRate} KHR`;
    }
    if (q.includes('interest') || q.includes('lãi') || q.includes('利息') || q.includes('ការប្រាក់')) {
      return lang === 'vi' ? `Lãi suất hiện tại: ${currentApy}% APY. Lãi chờ nhận: ${pendingInterest.toFixed(2)} USDT` :
             lang === 'zh' ? `当前利率: ${currentApy}% APY。待领利息: ${pendingInterest.toFixed(2)} USDT` :
             `Current APY: ${currentApy}%. Pending interest: ${pendingInterest.toFixed(2)} USDT`;
    }
    return lang === 'vi' ? 'Xin lỗi, tôi không hiểu câu hỏi. Bạn có thể hỏi về số dư, tỷ giá, hoặc lãi suất.' :
           lang === 'zh' ? '抱歉，我不太理解。您可以询问余额、汇率或利息。' :
           lang === 'km' ? 'សូមអភ័យទោស ខ្ញុំមិនយល់សំណួររបស់អ្នកទេ។ អ្នកអាចសួរអំពីសមតុល្យ អត្រា ឬការប្រាក់។' :
           "I'm not sure about that. You can ask about your balance, exchange rates, or interest.";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
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

        {systemConfig?.telegramSupportUrl && (
          <a
            href={systemConfig.telegramSupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold text-xs shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            {t.contactSupport}
          </a>
        )}
      </div>

      {/* Messages */}
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
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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
