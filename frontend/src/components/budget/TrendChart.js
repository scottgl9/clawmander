import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

export default function TrendChart({ refreshKey }) {
  const { data, loading, error } = useAPI(() => api.budget.getTrends(), [refreshKey]);

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;
  if (!data?.length) return null;

  // Custom tooltip to show savings/overspending
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPositive = data.isPositive;
      
      return (
        <div className="bg-surface border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white text-xs font-semibold mb-2">{data.monthFull}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">Income:</span>
              <span className="text-green-400">${data.income?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">Spent:</span>
              <span className="text-red-400">${data.spent?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-3 pt-1 border-t border-gray-600">
              <span className="text-white font-semibold">Net:</span>
              <span className={isPositive ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                {isPositive ? '+' : '-'}${Math.abs(data.netCashFlow || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">Savings:</span>
              <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                {data.savingsRate?.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">
        6-Month Cash Flow
        <span className="text-gray-500 font-normal ml-2 text-xs">(Green = Saved, Red = Overspent)</span>
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
          <Bar dataKey="netCashFlow" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isPositive ? '#10b981' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
