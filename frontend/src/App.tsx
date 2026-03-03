import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './views/HomeView';
import { KHQRView } from './views/KHQRView';
import { EarnView } from './views/EarnView';
import { AssistantView } from './views/AssistantView';
import { AdminDashboard } from './views/admin/AdminDashboard';
import { AdminLogin } from './views/admin/AdminLogin';
import { View, Language } from './types';
import { getToken } from './services/api';

const AccessDenied: React.FC = () => (
  <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
    <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/10 border border-slate-700">
      <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
    </div>
    <h1 className="text-2xl font-black text-white mb-2">Telegram Only</h1>
    <p className="text-slate-400 mb-8 max-w-xs leading-relaxed">
      Ứng dụng này chỉ hoạt động trên nền tảng Telegram để đảm bảo bảo mật.
    </p>
    <a href="https://t.me/" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all w-full max-w-xs">
      Mở Telegram
    </a>
  </div>
);

const Loading: React.FC = () => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-400 text-sm">Synchronizing...</p>
    </div>
  </div>
);

const UserApp: React.FC = () => {
  const [currentView, setView] = useState<View>(View.HOME);
  const [lang, setLang] = useState<Language>('en');
  const { isLoading, user } = useAuth();

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  if (isLoading) return <Loading />;

  if (user?.isBlocked) {
    const t = lang === 'vi' ? { title: 'Tài Khoản Bị Tạm Ngưng', msg: 'Tài khoản của bạn đang bị tạm ngưng do phát hiện hoạt động nghi vấn. Vui lòng liên hệ CSKH.' } :
              lang === 'zh' ? { title: '账户已冻结', msg: '由于发现可疑活动，您的账户已被暂停。请立即联系客服。' } :
              lang === 'km' ? { title: 'គណនីត្រូវបានផ្អាក', msg: 'គណនីរបស់អ្នកត្រូវបានផ្អាកដោយសារសកម្មភាពគួរឱ្យសង្ស័យ។ សូមទាក់ទងសេវាកម្មអតិថិជន។' } :
              { title: 'Account Suspended', msg: 'Your account has been suspended due to suspicious activity. Please contact Support immediately.' };
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-900/20 border border-red-500 rounded-2xl p-8 max-w-sm w-full">
          <h2 className="text-2xl font-bold text-red-500 mb-2 uppercase tracking-wide">{t.title}</h2>
          <p className="text-slate-300">{t.msg}</p>
        </div>
      </div>
    );
  }

  if (user?.isLocked) {
    const t = lang === 'vi' ? { title: 'Sai PIN Quá 5 Lần', msg: 'Tài khoản của bạn đã bị khóa tính năng thanh toán do nhập sai PIN 5 lần. Vui lòng liên hệ Admin để reset PIN.' } :
              lang === 'zh' ? { title: '密码锁定', msg: '由于5次输入错误密码，支付功能已被锁定。请联系管理员重置密码。' } :
              lang === 'km' ? { title: 'PIN ត្រូវបានចាក់សោ', msg: 'គណនីរបស់អ្នកត្រូវបានចាក់សោដោយសារបញ្ចូលលេខកូដ PIN ខុស 5 ដង។ សូមទាក់ទងអ្នកគ្រប់គ្រងដើម្បីកំណត់ PIN ឡើងវិញ។' } :
              { title: 'PIN Locked', msg: 'Your account has been locked due to 5 incorrect PIN attempts. Please contact Admin to reset PIN.' };
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-orange-900/20 border border-orange-500 rounded-2xl p-8 max-w-sm w-full">
          <h2 className="text-2xl font-bold text-orange-500 mb-2">{t.title}</h2>
          <p className="text-slate-300">{t.msg}</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case View.HOME: return <HomeView lang={lang} setView={setView} />;
      case View.KHQR: return <KHQRView lang={lang} setView={setView} />;
      case View.EARN: return <EarnView lang={lang} setView={setView} />;
      case View.ASSISTANT: return <AssistantView lang={lang} />;
      default: return <HomeView lang={lang} setView={setView} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-emerald-500/30">
      <Header lang={lang} setLang={setLang} />
      <main className="max-w-xl mx-auto min-h-screen relative pb-20">
        <div className="animate-fade-in">
          {renderView()}
        </div>
      </main>
      <BottomNav currentView={currentView} setView={setView} lang={lang} />
      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-scan { animation: scan 3s linear infinite; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

const AdminApp: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  if (!loggedIn) return <AdminLogin onLogin={() => setLoggedIn(true)} />;
  return <AdminDashboard onLogout={() => setLoggedIn(false)} />;
};

const AppRouter: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuth();

  const isAdmin = new URLSearchParams(window.location.search).get('mode') === 'admin' ||
                  window.location.pathname === '/admin';

  if (isAdmin) return <AdminApp />;

  if (isLoading) return <Loading />;

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
