import { useState, useEffect } from 'react';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';

export default function UpcomingBills() {
  const { data, loading, error } = useAPI(() => api.budget.getUpcomingBills());
  const [billDays, setBillDays] = useState({});

  useEffect(() => {
    if (data) {
      const days = {};
      data.forEach((bill, i) => {
        const due = new Date(bill.dueDate);
        days[i] = Math.ceil((due - Date.now()) / 86400000);
      });
      setBillDays(days);
    }
  }, [data]);

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">Upcoming Bills</h3>
      <div className="space-y-2">
        {data?.map((bill, i) => {
          const daysUntil = billDays[i];
          const urgent = daysUntil !== undefined && daysUntil <= 7 && daysUntil >= 0;
          return (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {urgent && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                <span className="text-gray-300">{bill.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-400" suppressHydrationWarning>
                  {new Date(bill.dueDate).toLocaleDateString()}
                </span>
                <span className="text-white font-medium">${bill.amount}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
