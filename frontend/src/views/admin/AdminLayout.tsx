import React, { useState } from 'react';

type AdminTab = 'dashboard' | 'users' | 'transactions' | 'wallets' | 'deposits' | 'config' | 'audit' | 'reports';

interface Props {
  currentTab: AdminTab;
  setTab: (tab: AdminTab) => void;
  pendingCount: number;
  children: React.ReactNode;
  onLogout: () => void;
}

const tabs: Array<{ id: AdminTab; label: string; icon: string; badge?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'transactions', label: 'Transactions', icon: '💸', badge: true },
  { id: 'wallets', label: 'Wallets & Energy', icon: '🔋' },
  { id: 'deposits', label: 'Deposits', icon: '📥' },
  { id: 'config', label: 'Settings', icon: '⚙️' },
  { id: 'audit', label: 'Audit Log', icon: '📝' },
  { id: 'reports', label: 'Reports', icon: '📈' },
];

export const AdminLayout: React.FC<Props> = ({ currentTab, setTab, pendingCount, children, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-dark-800 border-r border-dark-600 flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b border-dark-600 flex items-center justify-between">
          {sidebarOpen && (
            <div>
              <h1 className="text-lg font-black text-white">KHQRUP</h1>
              <p className="text-[10px] text-slate-500">Admin Panel</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white p-1"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="flex-1 py-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
                currentTab === tab.id
                  ? 'bg-primary-500/10 text-primary-400 border-r-2 border-primary-500'
                  : 'text-slate-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {sidebarOpen && (
                <span className="flex-1 text-left">{tab.label}</span>
              )}
              {sidebarOpen && tab.badge && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-600">
          <button
            onClick={onLogout}
            className="w-full text-left text-sm text-slate-500 hover:text-red-400 transition flex items-center gap-2"
          >
            <span>🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export type { AdminTab };
