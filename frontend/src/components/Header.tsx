import React from 'react';
import { Language } from '../types';
import { IconShield } from './Icons';

interface HeaderProps {
  lang: Language;
  setLang: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({ lang, setLang }) => {
  return (
    <header className="sticky top-0 z-50 bg-[#0f172a]/95 backdrop-blur-xl px-4 py-3 border-b border-slate-800 shadow-lg flex justify-between items-center transition-all duration-300">
      
      {/* BRANDING SECTION */}
      <div className="flex items-center gap-3 group cursor-default select-none">
        <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-md group-hover:bg-emerald-500/30 transition-all"></div>
            <IconShield className="w-full h-full drop-shadow-lg filter" />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f172a] animate-pulse"></div>
        </div>
        
        <div className="flex flex-col justify-center">
          <h1 className="text-xl font-black text-white tracking-tight leading-none italic" style={{ fontFamily: 'Inter, sans-serif' }}>
            365
            <span className="text-emerald-500 not-italic ml-0.5">Wallet</span>
          </h1>
          <span className="text-[9px] font-bold text-slate-400 tracking-[0.25em] uppercase leading-tight ml-0.5 mt-0.5">
            Secure Pay
          </span>
        </div>
      </div>

      {/* LANGUAGE SWITCHER (FLAGS) */}
      <div className="flex items-center gap-2">
        <div className="flex bg-slate-800/80 rounded-lg p-1 border border-slate-700">
           {(['en', 'zh', 'vi', 'km'] as Language[]).map((l) => (
             <button 
                key={l}
                onClick={() => setLang(l)}
                className={`w-8 h-7 flex items-center justify-center text-lg rounded-md transition-all duration-200 ${lang === l ? 'bg-slate-700 shadow-md scale-110' : 'hover:bg-slate-700/50 grayscale hover:grayscale-0'}`}
                title={l === 'zh' ? 'Chinese' : l === 'vi' ? 'Vietnamese' : l === 'km' ? 'Khmer' : 'English'}
             >
                {l === 'en' ? '🇺🇸' : l === 'zh' ? '🇨🇳' : l === 'vi' ? '🇻🇳' : '🇰🇭'}
             </button>
           ))}
        </div>
      </div>
    </header>
  );
};
