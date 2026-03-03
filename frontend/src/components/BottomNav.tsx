import React from 'react';
import { View, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { IconHome, IconQR, IconAssistant, IconEarn } from './Icons';

interface BottomNavProps {
  currentView: View;
  setView: (view: View) => void;
  lang: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView, lang }) => {
  const t = TRANSLATIONS[lang];

  const navItems = [
    { id: View.HOME, label: t.home, icon: <IconHome /> },
    { id: View.KHQR, label: t.khqr, icon: <IconQR /> },
    { id: View.EARN, label: t.earn, icon: <IconEarn /> },
    { id: View.ASSISTANT, label: t.assistant, icon: <IconAssistant /> }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-lg border-t border-slate-800 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
              currentView === item.id ? 'text-blue-500' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.icon}
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
