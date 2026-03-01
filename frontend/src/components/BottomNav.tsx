import React from 'react';
import { View } from '../types';

interface Props {
  currentView: View;
  setView: (view: View) => void;
}

const tabs = [
  { view: View.HOME, label: 'Wallet', icon: '💰' },
  { view: View.KHQR, label: 'Scan QR', icon: '📷' },
  { view: View.EARN, label: 'Earn', icon: '📈' },
  { view: View.HISTORY, label: 'History', icon: '📋' },
];

export const BottomNav: React.FC<Props> = ({ currentView, setView }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-800/95 backdrop-blur-xl border-t border-dark-600 z-50">
      <div className="max-w-xl mx-auto flex justify-around py-2 pb-safe">
        {tabs.map(({ view, label, icon }) => {
          const isActive = currentView === view;
          return (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all ${
                isActive
                  ? 'text-primary-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
