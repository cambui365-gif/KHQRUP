import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './views/HomeView';
import { KHQRView } from './views/KHQRView';
import { EarnView } from './views/EarnView';
import { HistoryView } from './views/HistoryView';
import { View } from './types';

const AccessDenied: React.FC = () => (
  <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-8 text-center">
    <div className="w-20 h-20 bg-dark-700 rounded-3xl flex items-center justify-center mb-6 border border-dark-600">
      <span className="text-4xl">🔒</span>
    </div>
    <h1 className="text-2xl font-black text-white mb-2">Telegram Only</h1>
    <p className="text-slate-400 mb-8 max-w-xs">
      This app only works inside Telegram for security.
    </p>
    <a
      href="https://t.me/"
      className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl font-bold transition-all w-full max-w-xs text-center"
    >
      Open Telegram
    </a>
  </div>
);

const Loading: React.FC = () => (
  <div className="min-h-screen bg-dark-900 flex items-center justify-center">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-400 text-sm">Connecting...</p>
    </div>
  </div>
);

const UserApp: React.FC = () => {
  const [currentView, setView] = useState<View>(View.HOME);

  const renderView = () => {
    switch (currentView) {
      case View.HOME: return <HomeView setView={setView} />;
      case View.KHQR: return <KHQRView setView={setView} />;
      case View.EARN: return <EarnView setView={setView} />;
      case View.HISTORY: return <HistoryView />;
      default: return <HomeView setView={setView} />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-slate-200 selection:bg-primary-500/30">
      <Header />
      <main className="max-w-xl mx-auto min-h-screen relative pb-20">
        {renderView()}
      </main>
      <BottomNav currentView={currentView} setView={setView} />
    </div>
  );
};

const AppRouter: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuth();
  const isAdmin = new URLSearchParams(window.location.search).get('mode') === 'admin' ||
                  window.location.pathname === '/admin';

  if (isLoading) return <Loading />;

  // Admin route - TODO: implement admin dashboard
  if (isAdmin) {
    return <div className="min-h-screen bg-dark-900 text-white p-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="text-slate-400 mt-2">Coming soon...</p>
    </div>;
  }

  // Check Telegram environment
  const isTelegram = !!window.Telegram?.WebApp?.initData;
  if (!isTelegram) return <AccessDenied />;
  if (!isAuthenticated) return <Loading />;

  return <UserApp />;
};

const App: React.FC = () => (
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);

export default App;
