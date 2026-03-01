import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';

export const ReportsTab: React.FC = () => {
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');

  useEffect(() => { loadReport(); }, [selectedDate]);
  useEffect(() => { loadReconciliation(); }, []);

  const loadReport = async () => {
    setLoading(true);
    const res = await adminApi.getDailyReport(selectedDate);
    if (res.success) setDailyReport(res.data);
    setLoading(false);
  };

  const loadReconciliation = async () => {
    const res = await adminApi.getReconciliation();
    if (res.success) setReconciliation(res.data);
  };

  const handleExport = () => {
    adminApi.exportTransactions(exportFrom || undefined, exportTo || undefined);
  };

  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-black text-white">Reports</h2>

      {/* Reconciliation */}
      {reconciliation && (
        <div className={`rounded-xl p-5 border ${
          Math.abs(reconciliation.discrepancy) < 1
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-red-500/5 border-red-500/30'
        }`}>
          <h3 className="text-sm font-bold text-white mb-4">🔍 Reconciliation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-slate-500">System Balance</p>
              <p className="text-lg font-bold text-white">{fmt(reconciliation.systemBalance)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">On-Chain (Children)</p>
              <p className="text-lg font-bold text-blue-400">{fmt(reconciliation.onChainChildWallets)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Discrepancy</p>
              <p className={`text-lg font-bold ${Math.abs(reconciliation.discrepancy) < 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(reconciliation.discrepancy)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Net Flow</p>
              <p className="text-lg font-bold text-white">{fmt(reconciliation.flowSummary?.netFlow)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-dark-800/50 rounded-lg p-2">
              <p className="text-[10px] text-slate-500">Total Deposits</p>
              <p className="text-sm font-bold text-emerald-400">{fmt(reconciliation.flowSummary?.totalDeposits)}</p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-2">
              <p className="text-[10px] text-slate-500">Total Withdrawals</p>
              <p className="text-sm font-bold text-red-400">{fmt(reconciliation.flowSummary?.totalWithdrawals)}</p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-2">
              <p className="text-[10px] text-slate-500">Interest Paid</p>
              <p className="text-sm font-bold text-yellow-400">{fmt(reconciliation.flowSummary?.totalInterestPaid)}</p>
            </div>
          </div>
          {reconciliation.walletsNeedingConsolidation?.length > 0 && (
            <div className="mt-3 bg-yellow-500/10 rounded-lg p-3">
              <p className="text-xs text-yellow-400 font-bold">
                ⚠️ {reconciliation.walletsNeedingConsolidation.length} wallet(s) need consolidation
              </p>
            </div>
          )}
        </div>
      )}

      {/* Daily Report */}
      <div className="bg-dark-700 rounded-xl p-5 border border-dark-600">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">📋 Daily Report</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-dark-800 text-white rounded-lg px-3 py-1.5 text-xs border border-dark-600"
          />
        </div>

        {loading ? (
          <div className="text-center py-6"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : dailyReport ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-dark-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500">Total Transactions</p>
                <p className="text-xl font-bold text-white">{dailyReport.totalTransactions}</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500">Total Volume</p>
                <p className="text-xl font-bold text-primary-400">{fmt(dailyReport.totalVolume)} USDT</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500">Deposits</p>
                <p className="text-lg font-bold text-emerald-400">{dailyReport.deposits.count} ({fmt(dailyReport.deposits.volume)})</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500">Payments</p>
                <p className="text-lg font-bold text-red-400">{dailyReport.payments.count} ({fmt(dailyReport.payments.volume)})</p>
              </div>
            </div>

            {/* By Status */}
            <div>
              <p className="text-xs text-slate-400 mb-2">By Status</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(dailyReport.byStatus || {}).map(([status, count]) => (
                  <span key={status} className="text-[10px] bg-dark-800 text-slate-300 px-2 py-1 rounded">
                    {status}: {count as number}
                  </span>
                ))}
              </div>
            </div>

            {/* By QR Type */}
            {Object.keys(dailyReport.byQrType || {}).length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">By QR Type</p>
                <div className="flex gap-2">
                  {Object.entries(dailyReport.byQrType).map(([type, count]) => (
                    <span key={type} className="text-[10px] bg-primary-500/20 text-primary-400 px-2 py-1 rounded">
                      {type}: {count as number}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-4">No data for this date</p>
        )}
      </div>

      {/* Export */}
      <div className="bg-dark-700 rounded-xl p-5 border border-dark-600">
        <h3 className="text-sm font-bold text-white mb-3">📥 Export Transactions (CSV)</h3>
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-[10px] text-slate-500">From</label>
            <input
              type="date"
              value={exportFrom}
              onChange={e => setExportFrom(e.target.value)}
              className="block bg-dark-800 text-white rounded-lg px-3 py-2 text-xs border border-dark-600 mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">To</label>
            <input
              type="date"
              value={exportTo}
              onChange={e => setExportTo(e.target.value)}
              className="block bg-dark-800 text-white rounded-lg px-3 py-2 text-xs border border-dark-600 mt-1"
            />
          </div>
          <button
            onClick={handleExport}
            className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            📥 Download CSV
          </button>
        </div>
      </div>
    </div>
  );
};
