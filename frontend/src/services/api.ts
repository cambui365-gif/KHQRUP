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

async function request<T>(path: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const data = await res.json();

    if (res.status === 401) {
      clearToken();
    }

    return data;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Auth
export const authApi = {
  loginTelegram: (initData: string) =>
    request<{ token: string; user: any; isAdmin: boolean }>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    }),

  loginAdmin: (username: string, password: string) =>
    request<{ token: string; isAdmin: boolean }>('/auth/admin', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
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
      method: 'POST',
      body: JSON.stringify(data),
    }),

  parseQR: (rawQrData: string) =>
    request<any>('/payment/parse-qr', {
      method: 'POST',
      body: JSON.stringify({ rawQrData }),
    }),

  getStatus: (txId: string) => request<any>(`/payment/status/${txId}`),
};

// Admin
export const adminApi = {
  getUsers: () => request<any[]>('/admin/users'),
  adjustBalance: (userId: number, amount: number, description: string) =>
    request('/admin/users/' + userId + '/adjust', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    }),
  blockUser: (userId: number) =>
    request('/admin/users/' + userId + '/block', { method: 'POST' }),
  resetPin: (userId: number) =>
    request('/admin/users/' + userId + '/reset-pin', { method: 'POST' }),
  deleteUser: (userId: number) =>
    request('/admin/users/' + userId, { method: 'DELETE' }),

  getTransactions: (limit = 100) => request<any[]>(`/admin/transactions?limit=${limit}`),
  approveTx: (txId: string) =>
    request('/admin/transactions/' + txId + '/approve', { method: 'POST' }),
  rejectTx: (txId: string) =>
    request('/admin/transactions/' + txId + '/reject', { method: 'POST' }),

  getWallets: () => request<any[]>('/admin/wallets'),
  refreshWallet: (address: string) =>
    request('/admin/wallets/' + address + '/refresh', { method: 'POST' }),
  consolidateWallet: (address: string, amount: number) =>
    request('/admin/wallets/' + address + '/consolidate', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  consolidateAll: () =>
    request('/admin/wallets/consolidate-all', { method: 'POST' }),

  getConfig: () => request<any>('/admin/config'),
  updateConfig: (config: any) =>
    request('/admin/config', { method: 'PUT', body: JSON.stringify(config) }),

  getDeposits: () => request<any[]>('/admin/deposits'),
  approveDeposit: (id: string) =>
    request('/admin/deposits/' + id + '/approve', { method: 'POST' }),
  rejectDeposit: (id: string) =>
    request('/admin/deposits/' + id + '/reject', { method: 'POST' }),

  getSavingsPlans: () => request<any[]>('/admin/savings/plans'),
  createPlan: (plan: any) =>
    request('/admin/savings/plans', { method: 'POST', body: JSON.stringify(plan) }),
  updatePlan: (id: string, data: any) =>
    request('/admin/savings/plans/' + id, { method: 'PUT', body: JSON.stringify(data) }),
};
