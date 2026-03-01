import React, { useState, useEffect } from 'react';
import { AdminLayout, AdminTab } from './AdminLayout';
import { DashboardTab } from './DashboardTab';
import { UsersTab } from './UsersTab';
import { TransactionsTab } from './TransactionsTab';
import { WalletsTab } from './WalletsTab';
import { DepositsTab } from './DepositsTab';
import { ConfigTab } from './ConfigTab';
import { AuditTab } from './AuditTab';
import { ReportsTab } from './ReportsTab';
import { adminApi, clearToken } from '../../services/api';

interface Props {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [currentTab, setTab] = useState<AdminTab>('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const loadPendingCount = async () => {
    const res = await adminApi.getPendingTransactions();
    if (res.success) setPendingCount(res.data?.length || 0);
  };

  const handleLogout = () => {
    clearToken();
    onLogout();
  };

  const renderTab = () => {
    switch (currentTab) {
      case 'dashboard': return <DashboardTab />;
      case 'users': return <UsersTab />;
      case 'transactions': return <TransactionsTab />;
      case 'wallets': return <WalletsTab />;
      case 'deposits': return <DepositsTab />;
      case 'config': return <ConfigTab />;
      case 'audit': return <AuditTab />;
      case 'reports': return <ReportsTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <AdminLayout currentTab={currentTab} setTab={setTab} pendingCount={pendingCount} onLogout={handleLogout}>
      {renderTab()}
    </AdminLayout>
  );
};
