import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';

export const AuditTab: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    const res = await adminApi.getAuditLogs(200);
    if (res.success) setLogs(res.data || []);
    setLoading(false);
  };

  const actionColor = (action: string) => {
    if (action.includes('DELETE')) return 'bg-red-500/20 text-red-400';
    if (action.includes('BLOCK')) return 'bg-orange-500/20 text-orange-400';
    if (action.includes('APPROVE')) return 'bg-emerald-500/20 text-emerald-400';
    if (action.includes('REJECT')) return 'bg-red-500/20 text-red-400';
    if (action.includes('ADJUST')) return 'bg-blue-500/20 text-blue-400';
    if (action.includes('STAKE') || action.includes('CONSOLIDATE')) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-slate-500/20 text-slate-400';
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">Audit Log</h2>
        <p className="text-xs text-slate-500">Append-only • Cannot be deleted</p>
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : logs.length === 0 ? (
        <p className="text-slate-500 text-center py-10">No audit logs yet</p>
      ) : (
        <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-dark-700">
              <tr className="border-b border-dark-600 text-slate-500 text-[10px] uppercase">
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Admin</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} className="border-b border-dark-600/50 hover:bg-dark-600/30">
                  <td className="px-4 py-2">
                    <p className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                  </td>
                  <td className="px-4 py-2">
                    <p className="text-xs text-white">{log.adminId}</p>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <p className="text-[10px] text-slate-400 max-w-md truncate">
                      {JSON.stringify(log.details)}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
