import { useState } from 'react';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import ProgressBar from '../shared/ProgressBar';
import BudgetDetailModal from './BudgetDetailModal';

export default function BudgetSummary() {
  const { data, loading, error } = useAPI(() => api.budget.getSummary());
  const [selectedCategory, setSelectedCategory] = useState(null);

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;

  const pct = data ? Math.round((data.totalSpent / data.budget) * 100) : 0;

  return (
    <>
      <div className="bg-surface rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-white mb-3">Budget - {data?.month}</h3>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>${data?.totalSpent?.toFixed(2)} spent</span>
          <span>${data?.remaining?.toFixed(2)} left</span>
        </div>
        <ProgressBar value={pct} className="mb-3" />
        <div className="space-y-2">
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
      </div>

      <BudgetDetailModal
        category={selectedCategory}
        isOpen={!!selectedCategory}
        onClose={() => setSelectedCategory(null)}
      />
    </>
  );
}
