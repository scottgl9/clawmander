import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function CashFlow({ cashflow }) {
  if (!cashflow || cashflow.safeToSpendPerDay == null) return null;

  const {
    safeToSpendPerDay, safeToSpendTotal, budgetRemainingPerDay, daysRemaining,
    projectedEomBalance, minBalance, minBalanceDate, lowBalanceRisk,
    lowBalanceThreshold, remainingIncome, committedBills, dailyBurn, dailyProjection,
  } = cashflow;

  return (
    <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Cash Flow & Safe-to-Spend</h3>
        <span className="text-xs text-gray-500">{daysRemaining} days left this month</span>
      </div>

      {lowBalanceRisk && (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          ⚠️ Projected low balance of <span className="font-semibold">{money(minBalance)}</span> on{' '}
          {fmtDate(minBalanceDate)} (below {money(lowBalanceThreshold)} threshold).
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">Safe to spend / day</div>
          <div className="text-2xl font-bold text-green-400">{money(safeToSpendPerDay)}</div>
          <div className="text-xs text-gray-500 mt-1">{money(safeToSpendTotal)} total</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">Current daily burn</div>
          <div className={`text-2xl font-bold ${dailyBurn > safeToSpendPerDay ? 'text-amber-400' : 'text-white'}`}>
            {money(dailyBurn)}
          </div>
          <div className="text-xs text-gray-500 mt-1">budget/day {money(budgetRemainingPerDay)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">Projected EOM balance</div>
          <div className={`text-2xl font-bold ${projectedEomBalance < 0 ? 'text-red-400' : 'text-white'}`}>
            {money(projectedEomBalance)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase mb-1">Incoming / committed</div>
          <div className="text-sm text-green-400">+{money(remainingIncome)} income</div>
          <div className="text-sm text-red-400">−{money(committedBills)} bills</div>
        </div>
      </div>

      {dailyProjection && dailyProjection.length > 1 && (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={dailyProjection} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={fmtDate} minTickGap={24} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={50}
              tickFormatter={(v) => `$${Math.round(v / 100) / 10}k`} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#fff' }} formatter={(v) => money(v)} labelFormatter={fmtDate} />
            <ReferenceLine y={lowBalanceThreshold} stroke="#ef4444" strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="#6b7280" />
            <Line type="monotone" dataKey="balance" stroke="#22c55e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="text-[11px] text-gray-600 mt-2">
        Projection assumes scheduled paychecks, predicted fixed bills, and your current discretionary burn rate.
      </p>
    </div>
  );
}
