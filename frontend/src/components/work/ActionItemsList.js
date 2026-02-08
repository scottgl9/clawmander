import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';

export default function ActionItemsList() {
  const { data, loading, error } = useAPI(() => api.work.getActionItems());

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">Action Items</h3>
      <ul className="space-y-2">
        {data?.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <span className={`mt-0.5 w-3 h-3 rounded border flex-shrink-0 ${item.done ? 'bg-green-500 border-green-500' : 'border-gray-600'}`} />
            <span className={`text-sm ${item.done ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
              {item.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
