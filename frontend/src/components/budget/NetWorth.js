import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function NetWorth({ data }) {
  const series = useMemo(
    () => (data || []).map((r) => ({ ...r, label: r.month })).sort((a, b) => String(a.month).localeCompare(String(b.month))),
    [data],
  );
  if (series.length === 0) return null;

  const latest = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const delta = prev ? latest.netWorth - prev.netWorth : null;

  return (
    <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Liquid Net Worth (cash position)</h3>
        <div className="text-right">
          <div className={`text-xl font-bold ${latest.netWorth < 0 ? 'text-red-400' : 'text-white'}`}>{money(latest.netWorth)}</div>
          {delta != null && (
            <div className={`text-xs ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {delta >= 0 ? '+' : ''}{money(delta)} vs prior
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={50}
            tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
          <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#fff' }} formatter={(v, k) => [money(v), k]} />
          <Area type="monotone" dataKey="netWorth" stroke="#14b8a6" strokeWidth={2} fill="url(#nwFill)" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-[11px] text-gray-500 mt-2">
        <span>Checking {money(latest.checking)}</span>
        <span>Savings {money(latest.savings)}</span>
        <span>Card debt {money(latest.cardDebt)}</span>
      </div>
      <p className="text-[11px] text-gray-600 mt-1">Liquid only (linked WF accounts). Excludes unlinked cards, home, and retirement.</p>
    </div>
  );
}
