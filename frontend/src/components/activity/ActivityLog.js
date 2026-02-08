import { useState } from 'react';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';

export default function ActivityLog({ limit = 20, showHeader = true }) {
  const [collapsed, setCollapsed] = useState(false);
  const { data, loading, error } = useAPI(() => api.activity.getLog({ limit }));

  if (loading) return <div className="text-gray-600 text-xs">Loading activity...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;

  const items = data?.items || [];

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      {showHeader && (
        <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
          <h3 className="text-sm font-semibold text-white">Activity Log</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">{data?.total || 0} entries</span>
            <span className="text-gray-500 text-xs">{collapsed ? '+' : '-'}</span>
          </div>
        </div>
      )}
      {!collapsed && (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {items.length === 0 && <p className="text-xs text-gray-600">No activity yet</p>}
          {items.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 py-1 text-xs">
              <span className="text-gray-600 font-mono flex-shrink-0 w-16" suppressHydrationWarning>
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`px-1 rounded flex-shrink-0 ${
                entry.type === 'api' ? 'text-blue-400 bg-blue-400/10' :
                entry.type === 'agent' ? 'text-green-400 bg-green-400/10' :
                'text-gray-400 bg-gray-400/10'
              }`}>
                {entry.type}
              </span>
              <span className="text-gray-400 truncate">{entry.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
