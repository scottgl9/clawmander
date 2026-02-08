import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function TrendChart() {
  const { data, loading, error } = useAPI(() => api.budget.getTrends());

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;
  if (!data?.length) return null;

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">Spending Trends</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#fff' }}
          />
          <ReferenceLine y={4000} stroke="#e94560" strokeDasharray="3 3" />
          <Bar dataKey="spent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
