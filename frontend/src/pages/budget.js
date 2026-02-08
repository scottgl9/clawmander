import { useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import ProgressBar from '../components/shared/ProgressBar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import BudgetDetailModal from '../components/budget/BudgetDetailModal';

export default function BudgetPage() {
  const connected = useSSE(() => {});
  const { data: summary, loading, error, reload } = useAPI(() => api.budget.getSummary());
  const { data: trends } = useAPI(() => api.budget.getTrends());
  const { data: transactions } = useAPI(() => fetch('/api/budget/transactions').then(r => r.json()));
  const [selectedCategory, setSelectedCategory] = useState(null);

  return (
    <Layout connected={connected}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-1">Budget</h2>
        <p className="text-sm text-gray-500 mb-6">{summary?.monthName || 'Loading...'}</p>

        {loading && <p className="text-gray-600">Loading budget data...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {summary && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface rounded-lg p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Total Budget</div>
                <div className="text-3xl font-bold text-white">${summary.totalBudget?.toFixed(2)}</div>
              </div>
              <div className="bg-surface rounded-lg p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Total Spent</div>
                <div className={`text-3xl font-bold ${summary.totalSpent > summary.totalBudget ? 'text-red-400' : 'text-blue-400'}`}>
                  ${summary.totalSpent?.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round((summary.totalSpent / summary.totalBudget) * 100)}% of budget
                </div>
              </div>
              <div className="bg-surface rounded-lg p-6 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase mb-1">Remaining</div>
                <div className={`text-3xl font-bold ${summary.remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ${summary.remaining?.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="bg-surface rounded-lg p-6 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-4">Overall Budget Usage</h3>
              <ProgressBar value={Math.round((summary.totalSpent / summary.totalBudget) * 100)} className="mb-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>${summary.totalSpent?.toFixed(2)} spent</span>
                <span>${summary.totalBudget?.toFixed(2)} budget</span>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-surface rounded-lg p-6 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-4">Categories</h3>
              <div className="space-y-4">
                {summary.categories?.map((category) => {
                  const isOverBudget = category.spent > category.budget;
                  return (
                    <div
                      key={category.id}
                      className="cursor-pointer hover:bg-surface-light p-3 rounded transition-colors"
                      onClick={() => setSelectedCategory(category)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-medium text-white">{category.name}</div>
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

            {/* Spending Trends */}
            {trends && trends.length > 0 && (
              <div className="bg-surface rounded-lg p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-4">6-Month Spending Trend</h3>
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

            {/* Recent Transactions */}
            {transactions && transactions.length > 0 && (
              <div className="bg-surface rounded-lg p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-4">Recent Transactions</h3>
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
