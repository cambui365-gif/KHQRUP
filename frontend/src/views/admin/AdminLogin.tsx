import React, { useState } from 'react';
import { authApi, setToken } from '../../services/api';

interface Props {
  onLogin: () => void;
}

export const AdminLogin: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await authApi.loginAdmin(username, password);
    setLoading(false);

    if (res.success && res.data) {
      setToken(res.data.token);
      onLogin();
    } else {
      setError(res.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-dark-700 rounded-2xl p-8 border border-dark-600 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center text-2xl font-black text-white mb-4 shadow-lg shadow-primary-500/20">
            K
          </div>
          <h1 className="text-xl font-black text-white">KHQRUP Admin</h1>
          <p className="text-xs text-slate-500 mt-1">Enter your credentials</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            className="w-full bg-dark-800 text-white rounded-xl px-4 py-3 text-sm border border-dark-600 focus:border-primary-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-dark-800 text-white rounded-xl px-4 py-3 text-sm border border-dark-600 focus:border-primary-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-dark-600 text-white py-3 rounded-xl font-bold text-sm transition-all"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};
