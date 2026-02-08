import Modal from '../shared/Modal';
import ProgressBar from '../shared/ProgressBar';

export default function BudgetDetailModal({ category, isOpen, onClose }) {
  if (!category) return null;

  const percentage = Math.round((category.spent / category.budget) * 100);
  const remaining = category.budget - category.spent;
  const overBudget = category.spent > category.budget;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${category.name} Budget Details`}>
      <div className="space-y-6">
        {/* Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-light rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 uppercase mb-1">Budget</div>
            <div className="text-2xl font-bold text-white">${category.budget}</div>
          </div>
          <div className="bg-surface-light rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 uppercase mb-1">Spent</div>
            <div className={`text-2xl font-bold ${overBudget ? 'text-red-400' : 'text-blue-400'}`}>
              ${category.spent}
            </div>
          </div>
          <div className="bg-surface-light rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 uppercase mb-1">Remaining</div>
            <div className={`text-2xl font-bold ${remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
              ${remaining.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Budget Usage</span>
            <span className={`text-sm font-semibold ${overBudget ? 'text-red-400' : 'text-gray-300'}`}>
              {percentage}%
            </span>
          </div>
          <ProgressBar value={percentage} />
          {overBudget && (
            <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              Over budget by ${Math.abs(remaining).toFixed(2)}
            </div>
          )}
        </div>

        {/* Sample Transactions (placeholder) */}
        <div>
          <label className="text-xs text-gray-500 uppercase mb-3 block">Recent Transactions</label>
          <div className="space-y-2">
            {generateSampleTransactions(category.name).map((txn, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <div className="text-sm text-white">{txn.description}</div>
                  <div className="text-xs text-gray-500">{txn.date}</div>
                </div>
                <div className="text-sm text-gray-300 font-mono">${txn.amount}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="text-sm font-medium text-blue-300 mb-1">Budget Tip</div>
              <div className="text-xs text-gray-400">
                {getBudgetTip(category.name, percentage)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function generateSampleTransactions(category) {
  const transactions = {
    Housing: [
      { description: 'Monthly Rent', amount: '1,200.00', date: 'Feb 1, 2026' },
    ],
    Food: [
      { description: 'Whole Foods', amount: '87.43', date: 'Feb 7, 2026' },
      { description: 'Starbucks', amount: '12.50', date: 'Feb 6, 2026' },
      { description: 'Restaurant', amount: '45.20', date: 'Feb 5, 2026' },
    ],
    Transport: [
      { description: 'Gas Station', amount: '52.00', date: 'Feb 6, 2026' },
      { description: 'Uber', amount: '18.50', date: 'Feb 4, 2026' },
    ],
    Subscriptions: [
      { description: 'Netflix', amount: '15.99', date: 'Feb 1, 2026' },
      { description: 'Spotify', amount: '9.99', date: 'Feb 1, 2026' },
    ],
    Other: [
      { description: 'Amazon', amount: '234.56', date: 'Feb 5, 2026' },
      { description: 'Target', amount: '67.89', date: 'Feb 3, 2026' },
    ],
  };
  return transactions[category] || [];
}

function getBudgetTip(category, percentage) {
  if (percentage > 100) {
    return `You're over budget on ${category}. Consider reducing spending in this category or adjusting your budget allocation.`;
  }
  if (percentage > 80) {
    return `You're close to your ${category} budget limit. Monitor spending carefully for the rest of the month.`;
  }
  if (percentage < 50) {
    return `Great job staying under budget for ${category}! You're on track for the month.`;
  }
  return `You're using your ${category} budget at a healthy pace. Keep it up!`;
}
