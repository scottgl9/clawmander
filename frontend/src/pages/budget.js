import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import ProgressBar from '../components/shared/ProgressBar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import BudgetDetailModal from '../components/budget/BudgetDetailModal';
import Subscriptions from '../components/budget/Subscriptions';
import SinkingFunds from '../components/budget/SinkingFunds';
import CashFlow from '../components/budget/CashFlow';
import NetWorth from '../components/budget/NetWorth';

function badgeClass(kind = 'variable') {
  if (kind === 'fixed') return 'bg-emerald-500/20 text-emerald-300';
  if (kind === 'transfer') return 'bg-indigo-500/20 text-indigo-300';
  if (kind === 'financial') return 'bg-purple-500/20 text-purple-300';
  if (kind === 'income') return 'bg-teal-500/20 text-teal-300';
  return 'bg-gray-500/20 text-gray-300';
}

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function isValidMonthKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

function parseMonthKey(monthKey) {
  if (!isValidMonthKey(monthKey)) return null;
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  return new Date(year, monthIndex, 1);
}

function shiftMonth(monthKey, delta) {
  const base = parseMonthKey(monthKey) || parseMonthKey(getCurrentMonthKey());
  const shifted = new Date(base.getFullYear(), base.getMonth() + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey) {
  const date = parseMonthKey(monthKey);
  return date
    ? date.toLocaleString('default', { month: 'long', year: 'numeric' })
    : monthKey;
}

function getMonthRange(monthKey) {
  const date = parseMonthKey(monthKey) || parseMonthKey(getCurrentMonthKey());
  const year = date.getFullYear();
  const month = date.getMonth();
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
  return { startDate, endDate };
}

export default function BudgetPage() {
  const router = useRouter();
  const connected = useSSE(() => {});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const currentMonth = getCurrentMonthKey();
  const selectedMonth = useMemo(() => {
    const requested = Array.isArray(router.query.month) ? router.query.month[0] : router.query.month;
    return isValidMonthKey(requested) ? requested : currentMonth;
  }, [router.query.month]);
  const monthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const isCurrentMonth = selectedMonth === currentMonth;

  const { data: summary, loading, error } = useAPI(
    () => api.budget.getSummary({ month: selectedMonth }),
    [selectedMonth],
  );
  const { data: trends } = useAPI(
    () => api.budget.getTrends({ months: 6, endMonth: selectedMonth }),
    [selectedMonth],
  );
  const { data: transactions } = useAPI(
    () => api.budget.getTransactions(monthRange),
    [monthRange.startDate, monthRange.endDate],
  );
  const { data: status } = useAPI(
    () => api.budget.getStatus({ month: selectedMonth }),
    [selectedMonth],
  );
  const { data: balances } = useAPI(
    () => api.budget.getBalances({ month: selectedMonth }),
    [selectedMonth],
  );
  const { data: subscriptions } = useAPI(
    () => api.budget.getSubscriptions({ month: selectedMonth }),
    [selectedMonth],
  );
  const { data: networth } = useAPI(
    () => api.budget.getNetworth({ limit: 12 }),
    [selectedMonth],
  );

  function updateSelectedMonth(nextMonth) {
    const nextQuery = { ...router.query };
    if (nextMonth === currentMonth) {
      delete nextQuery.month;
    } else {
      nextQuery.month = nextMonth;
    }
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }

  const sourceGeneratedAt = status?.sourceGeneratedAt || summary?.dataFreshness?.sourceGeneratedAt;
  const syncedAt = status?.syncedAt || summary?.dataFreshness?.syncedAt;

  return (
    <Layout connected={connected}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Budget</h2>
            <p className="text-sm text-gray-500">{summary?.monthName || formatMonthLabel(selectedMonth)}</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => updateSelectedMonth(shiftMonth(selectedMonth, -1))}
              className="h-9 min-w-9 px-3 rounded-md border border-gray-700 bg-surface text-sm text-gray-200 hover:bg-surface-light transition-colors"
              aria-label="Previous month"
            >
              Prev
            </button>
            <div className="min-w-[10rem] rounded-md border border-gray-800 bg-surface px-3 py-2 text-center text-sm font-medium text-white">
              {formatMonthLabel(selectedMonth)}
            </div>
            <button
              type="button"
              onClick={() => updateSelectedMonth(shiftMonth(selectedMonth, 1))}
              disabled={isCurrentMonth}
              className="h-9 min-w-9 px-3 rounded-md border border-gray-700 bg-surface text-sm text-gray-200 hover:bg-surface-light transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
              aria-label="Next month"
            >
              Next
            </button>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => updateSelectedMonth(currentMonth)}
                className="h-9 px-3 rounded-md border border-gray-700 bg-surface text-sm text-gray-200 hover:bg-surface-light transition-colors"
              >
                Current
              </button>
            )}
          </div>
        </div>

        {loading && <p className="text-gray-600">Loading budget data...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {summary && (
          <div className="space-y-6">
            <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-4">Current State</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-gray-300">
                <div>
                  <div className="text-gray-500 uppercase mb-1">Source</div>
                  <div className="text-white">{summary.dataFreshness?.source || 'budget-agent'}</div>
                </div>
                <div>
                  <div className="text-gray-500 uppercase mb-1">Source generated</div>
                  <div className="text-white text-[12px] break-words">{sourceGeneratedAt || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-gray-500 uppercase mb-1">Last synced</div>
                  <div className="text-white">{syncedAt ? new Date(syncedAt).toLocaleString() : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-gray-500 uppercase mb-1">Uncategorized</div>
                  <div className="text-white">{summary.dataFreshness?.uncategorizedCount || 0}</div>
                </div>
              </div>
            </div>

            {summary.alerts?.length > 0 && (
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-4">Budget Alerts</h3>
                <div className="space-y-2 text-sm">
                  {summary.alerts.map((alert, idx) => {
                    const level = alert.level || 'warning';
                    const cls = level === 'critical' ? 'text-red-300 border-red-500/40 bg-red-500/10'
                      : level === 'info' ? 'text-gray-300 border-gray-700 bg-gray-500/5'
                      : 'text-amber-300 border-amber-500/30 bg-amber-500/10';
                    const icon = level === 'critical' ? '🔴' : level === 'info' ? 'ℹ️' : '⚠️';
                    return (
                      <div key={`${alert.type || alert.category || idx}-${alert.message}`}
                        className={`rounded-md border px-3 py-2 ${cls}`}>
                        <span className="mr-1">{icon}</span>{alert.message}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isCurrentMonth && <CashFlow cashflow={status?.cashflow} />}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Total Budget</div>
                <div className="text-3xl font-bold text-white">${summary.totalBudget?.toFixed(2)}</div>
              </div>
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Total Spent</div>
                <div className={`text-3xl font-bold ${summary.totalSpent > summary.totalBudget ? 'text-red-400' : 'text-blue-400'}`}>
                  ${summary.totalSpent?.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {summary.totalBudget > 0 ? `${Math.round((summary.totalSpent / summary.totalBudget) * 100)}% of budget` : 'No budget set'}
                </div>
              </div>
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Remaining</div>
                <div className={`text-3xl font-bold ${summary.remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ${summary.remaining?.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Fixed Budget</div>
                <div className="text-2xl font-bold text-white">${summary.fixedBudget?.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">Spent ${summary.fixedSpent?.toFixed(2)}</div>
              </div>
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Variable Budget</div>
                <div className="text-2xl font-bold text-white">${summary.variableBudget?.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">Spent ${summary.variableSpent?.toFixed(2)}</div>
              </div>
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Variable Remaining</div>
                <div className={`text-2xl font-bold ${summary.variableRemaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ${summary.variableRemaining?.toFixed(2)}
                </div>
              </div>
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Projected Net</div>
                <div className={`text-2xl font-bold ${summary.projectedNetEom < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {summary.projectedNetEom == null ? 'N/A' : `$${summary.projectedNetEom?.toFixed(2)}`}
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-4">Overall Budget Usage</h3>
              <ProgressBar value={summary.totalBudget > 0 ? Math.round((summary.totalSpent / summary.totalBudget) * 100) : 0} className="mb-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>${summary.totalSpent?.toFixed(2)} spent</span>
                <span>${summary.totalBudget?.toFixed(2)} budget</span>
              </div>
            </div>

            <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-4">Categories</h3>
              <div className="space-y-4">
                {summary.categories?.map((category) => {
                  const isOverBudget = category.budget > 0 && category.spent > category.budget;
                  return (
                    <div
                      key={category.id}
                      className="cursor-pointer hover:bg-surface-light p-3 rounded transition-colors"
                      onClick={() => setSelectedCategory(category)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-medium text-white">{category.name}</div>
                          <span className={`px-2 py-0.5 text-[10px] rounded font-semibold ${badgeClass(category.budgetKind)}`}>
                            {category.budgetKind || 'variable'}
                          </span>
                          {isOverBudget && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded font-semibold">
                              OVER BUDGET
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          ${category.spent?.toFixed(2)} / ${category.budget?.toFixed(2)}
                        </div>
                      </div>
                      <ProgressBar value={category.percentage} />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{category.percentage}% used</span>
                        <span className={category.remaining < 0 ? 'text-red-400' : 'text-green-400'}>
                          ${Math.abs(category.remaining)?.toFixed(2)} {category.remaining < 0 ? 'over' : 'remaining'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Subscriptions data={subscriptions} />

            <SinkingFunds data={subscriptions} />

            <NetWorth data={networth} />

            {trends && trends.length > 0 && (
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-4">6-Month Cash Flow</h3>

                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 text-gray-400 font-medium">Month</th>
                        <th className="text-right py-2 text-gray-400 font-medium">Income</th>
                        <th className="text-right py-2 text-gray-400 font-medium">Spent</th>
                        <th className="text-right py-2 text-gray-400 font-medium">Subs</th>
                        <th className="text-right py-2 text-gray-400 font-medium">Net</th>
                        <th className="text-right py-2 text-gray-400 font-medium">Projected Net</th>
                        <th className="text-right py-2 text-gray-400 font-medium">Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trends.map((month) => (
                        <tr
                          key={month.monthKey}
                          className={`border-b border-gray-800 ${month.monthKey === selectedMonth ? 'bg-surface-light/60' : ''}`}
                        >
                          <td className="py-3 text-white">
                            {month.monthFull}
                            {month.monthKey === selectedMonth ? <span className="text-[10px] text-blue-300 ml-2">(viewing)</span> : null}
                            {month.isProjected ? <span className="text-[10px] text-amber-300 ml-2">(projected)</span> : null}
                          </td>
                          <td className="text-right text-green-400">${month.income?.toFixed(2)}</td>
                          <td className="text-right text-red-400">${month.spent?.toFixed(2)}</td>
                          <td className="text-right text-gray-400">${(month.subscriptionCost || 0).toFixed(2)}</td>
                          <td className={`text-right font-semibold ${month.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {month.isPositive ? '+' : ''}${month.netCashFlow?.toFixed(2)}
                            {month.isPositive ? ' ✅' : ' ⚠️'}
                          </td>
                          <td className="text-right text-gray-300">
                            {month.projectedNetEom == null ? 'N/A' : `${month.projectedNetEom >= 0 ? '+' : ''}$${month.projectedNetEom?.toFixed(2)}`}
                          </td>
                          <td className={`text-right ${month.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {month.savingsRate?.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trends}>
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <ReferenceLine y={summary.totalBudget} stroke="#e94560" strokeDasharray="3 3" label={{ value: 'Budget', fill: '#e94560', fontSize: 10 }} />
                    <Bar dataKey="spent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {balances?.accounts && balances.accounts.length > 0 && (
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-4">Account Balances</h3>
                <div className="space-y-2">
                  {balances.accounts.map((account) => (
                    <div key={account.id || account.name} className="flex justify-between text-sm text-white">
                      <span>{account.name || account.id}</span>
                      <span>${Number(account.balance || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transactions && transactions.length > 0 && (
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-4">Transactions for {formatMonthLabel(selectedMonth)}</h3>
                <div className="space-y-2">
                  {transactions.slice(0, 10).map((txn) => {
                    const category = summary.categories?.find(c => c.id === txn.categoryId);
                    return (
                      <div key={txn.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm text-white">{txn.description}</div>
                            <div className="text-xs text-gray-500">
                              {txn.merchant && `${txn.merchant} • `}
                              {category?.name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-300 font-mono">${txn.amount?.toFixed(2)}</div>
                          <div className="text-xs text-gray-600">
                            {new Date(txn.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {transactions && transactions.length === 0 && (
              <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-1">Transactions for {formatMonthLabel(selectedMonth)}</h3>
                <p className="text-sm text-gray-500">No transactions synced for this month.</p>
              </div>
            )}
          </div>
        )}

        <BudgetDetailModal
          category={selectedCategory}
          isOpen={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
        />
      </div>
    </Layout>
  );
}
