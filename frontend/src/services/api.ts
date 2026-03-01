const API_BASE = import.meta.env.VITE_API_URL || '/api';

let authToken: string | null = null;

export function setToken(token: string) {
  authToken = token;
  localStorage.setItem('khqrup_token', token);
}

export function getToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('khqrup_token');
  }
  return authToken;
}

export function clearToken() {
  authToken = null;
  localStorage.removeItem('khqrup_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string; pagination?: any }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.headers.get('content-type')?.includes('text/csv')) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.split('filename=')[1] || 'export.csv';
      a.click();
      return { success: true };
    }
    const data = await res.json();
    if (res.status === 401) clearToken();
    return data;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Auth
export const authApi = {
  loginTelegram: (initData: string) =>
    request<{ token: string; user: any; isAdmin: boolean }>('/auth/telegram', {
      method: 'POST', body: JSON.stringify({ initData }),
    }),
  loginAdmin: (username: string, password: string) =>
    request<{ token: string; isAdmin: boolean }>('/auth/admin', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
};

// User
export const userApi = {
  getProfile: () => request<any>('/user/profile'),
  getWallet: () => request<any>('/user/wallet'),
  setPin: (pin: string, currentPin?: string) =>
    request('/user/pin', { method: 'POST', body: JSON.stringify({ pin, currentPin }) }),
  getTransactions: (limit = 50) => request<any[]>(`/user/transactions?limit=${limit}`),
  claimInterest: () => request('/user/interest/claim', { method: 'POST' }),
  getConfig: () => request<any>('/user/config'),
};

// Payment
export const paymentApi = {
  payQR: (data: { rawQrData: string; amount: number; currency: string; pin: string; note?: string }) =>
    request<{ transactionId: string; status: string }>('/payment/qr', {
      method: 'POST', body: JSON.stringify(data),
    }),
  parseQR: (rawQrData: string) =>
    request<any>('/payment/parse-qr', { method: 'POST', body: JSON.stringify({ rawQrData }) }),
  getStatus: (txId: string) => request<any>(`/payment/status/${txId}`),
};

// Admin
export const adminApi = {
  // Dashboard
  getDashboard: () => request<any>('/admin/dashboard'),
  getDashboardChart: (days = 30) => request<any>(`/admin/dashboard/chart?days=${days}`),

  // Users
  getUsers: (params?: { search?: string; status?: string; page?: number; limit?: number; sortBy?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', params.page.toString());
    if (params?.limit) qs.set('limit', params.limit.toString());
    if (params?.sortBy) qs.set('sortBy', params.sortBy);
    return request<any[]>(`/admin/users?${qs}`);
  },
  getUser: (id: number) => request<any>(`/admin/users/${id}`),
  adjustBalance: (userId: number, amount: number, description: string) =>
    request(`/admin/users/${userId}/adjust`, { method: 'POST', body: JSON.stringify({ amount, description }) }),
  blockUser: (userId: number) =>
    request(`/admin/users/${userId}/block`, { method: 'POST' }),
  resetPin: (userId: number) =>
    request(`/admin/users/${userId}/reset-pin`, { method: 'POST' }),
  setUserLimit: (userId: number, limits: any) =>
    request(`/admin/users/${userId}/set-limit`, { method: 'POST', body: JSON.stringify(limits) }),
  deleteUser: (userId: number) =>
    request(`/admin/users/${userId}`, { method: 'DELETE' }),

  // Transactions
  getTransactions: (params?: { status?: string; type?: string; userId?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.type) qs.set('type', params.type);
    if (params?.userId) qs.set('userId', params.userId);
    if (params?.page) qs.set('page', params.page.toString());
    if (params?.limit) qs.set('limit', params.limit.toString());
    return request<any[]>(`/admin/transactions?${qs}`);
  },
  getPendingTransactions: () => request<any[]>('/admin/transactions/pending'),
  approveTx: (txId: string) =>
    request(`/admin/transactions/${txId}/approve`, { method: 'POST' }),
  rejectTx: (txId: string, reason?: string) =>
    request(`/admin/transactions/${txId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Wallets
  getWallets: (withBalance = false) =>
    request<any[]>(`/admin/wallets${withBalance ? '?withBalance=true' : ''}`),
  refreshWallet: (address: string) =>
    request(`/admin/wallets/${address}/refresh`, { method: 'POST' }),
  refreshAllWallets: () =>
    request('/admin/wallets/refresh-all', { method: 'POST' }),
  consolidateWallet: (address: string, amount: number) =>
    request(`/admin/wallets/${address}/consolidate`, { method: 'POST', body: JSON.stringify({ amount }) }),
  consolidateAll: (threshold?: number) =>
    request('/admin/wallets/consolidate-all', { method: 'POST', body: JSON.stringify({ threshold }) }),

  // Energy
  getEnergy: () => request<any>('/admin/energy'),
  stakeEnergy: (amountTRX: number) =>
    request('/admin/energy/stake', { method: 'POST', body: JSON.stringify({ amountTRX }) }),
  unstakeEnergy: (amountTRX: number) =>
    request('/admin/energy/unstake', { method: 'POST', body: JSON.stringify({ amountTRX }) }),
  getEnergyLogs: (limit = 50) => request<any[]>(`/admin/energy/logs?limit=${limit}`),

  // Deposits
  getDeposits: (status = 'PENDING') => request<any[]>(`/admin/deposits?status=${status}`),
  approveDeposit: (id: string) =>
    request(`/admin/deposits/${id}/approve`, { method: 'POST' }),
  rejectDeposit: (id: string) =>
    request(`/admin/deposits/${id}/reject`, { method: 'POST' }),

  // Config
  getConfig: () => request<any>('/admin/config'),
  updateConfig: (config: any) =>
    request('/admin/config', { method: 'PUT', body: JSON.stringify(config) }),

  // Savings
  getSavingsPlans: () => request<any[]>('/admin/savings/plans'),
  createPlan: (plan: any) =>
    request('/admin/savings/plans', { method: 'POST', body: JSON.stringify(plan) }),
  updatePlan: (id: string, data: any) =>
    request(`/admin/savings/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Audit & Reports (P1-P2)
  getAuditLogs: (limit = 100) => request<any[]>(`/admin/audit-logs?limit=${limit}`),
  getReconciliation: () => request<any>('/admin/reconciliation'),
  getDailyReport: (date?: string) =>
    request<any>(`/admin/reports/daily${date ? `?date=${date}` : ''}`),
  exportTransactions: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return request(`/admin/reports/export?${qs}`);
  },
};
