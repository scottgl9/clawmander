import { useState } from 'react';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import ProgressBar from '../shared/ProgressBar';
import BudgetDetailModal from './BudgetDetailModal';

export default function BudgetSummary({ refreshKey }) {
  const { data, loading, error } = useAPI(() => api.budget.getSummary(), [refreshKey]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expanded, setExpanded] = useState(false);

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;

  const pct = data ? Math.round((data.totalSpent / data.totalBudget) * 100) : 0;

  return (
    <>
      <div className="bg-surface rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-white mb-3">Budget - {data?.monthName}</h3>

        {/* Cash Flow Summary */}
        <div className="mb-3 p-3 rounded-lg bg-surface-light border border-gray-700">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-400">Income</span>
            <span className="text-green-400">${data?.income?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-400">Spent</span>
            <span className="text-red-400">${data?.totalSpent?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs pt-2 border-t border-gray-600">
            <span className="font-semibold text-white">Net Cash Flow</span>
            <span className={`font-semibold ${data?.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {data?.isPositive ? '+' : '-'}${Math.abs(data?.netCashFlow || 0).toFixed(2)}
              {data?.isPositive ? ' ✅' : ' ⚠️'}
            </span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-gray-500">Savings Rate</span>
            <span className={`${data?.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {data?.savingsRate?.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>${data?.totalSpent?.toFixed(2)} of budget</span>
          <span>${data?.remaining?.toFixed(2)} left</span>
        </div>
        <ProgressBar value={pct} className="mb-3" />

        {expanded && (
          <div className="space-y-2 mb-3">
            {data?.categories?.map((cat) => (
              <div
                key={cat.name}
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-surface-light p-1 rounded transition-colors"
                onClick={() => setSelectedCategory(cat)}
              >
                <span className="text-gray-400">{cat.name}</span>
                <span className="text-gray-300">${cat.spent} / ${cat.budget}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {expanded ? 'Hide categories' : 'Show categories'}
        </button>
      </div>

      <BudgetDetailModal
        category={selectedCategory}
        isOpen={!!selectedCategory}
        onClose={() => setSelectedCategory(null)}
      />
    </>
  );
}
