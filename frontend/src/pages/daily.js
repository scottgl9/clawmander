import { useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import { StatusBadge, PriorityBadge } from '../components/shared/Badge';

export default function DailyView() {
  const connected = useSSE(() => {});
  const { data, loading, error } = useAPI(() => api.views.getDaily());
  const [expandedId, setExpandedId] = useState(null);

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-1">Daily View</h2>
        <p className="text-sm text-gray-500 mb-6">{data?.date || 'Today'}</p>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {data && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(data.stats?.byStatus || {}).map(([status, count]) => (
                <div key={status} className="bg-surface rounded-lg p-3 border border-gray-800 text-center">
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-xs text-gray-500 capitalize">{status.replace('_', ' ')}</div>
                </div>
              ))}
            </div>

            {/* Today's tasks */}
            <div className="bg-surface rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-3">Today&apos;s Tasks</h3>
              <div className="space-y-1">
                {data.tasks?.map((task) => (
                  <div key={task.id}>
                    <div
                      className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 cursor-pointer hover:bg-surface-light px-2 -mx-2 rounded transition-colors"
                      onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-accent transition-transform text-xs ${expandedId === task.id ? 'rotate-90' : ''}`}>{'>'}</span>
                        <StatusBadge status={task.status} />
                        <span className="text-sm text-gray-300">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        {task.progress > 0 && <span className="text-xs text-gray-500">{task.progress}%</span>}
                      </div>
                    </div>
                    {expandedId === task.id && (
                      <div className="ml-7 mt-1 mb-2 text-xs border-l border-gray-700 pl-3 space-y-1">
                        {task.details && <p className="text-gray-300">{task.details}</p>}
                        {task.description && !task.details && <p className="text-gray-400">{task.description}</p>}
                        {task.details && task.description && <p className="text-gray-500">{task.description}</p>}
                        {!task.details && !task.description && <p className="text-gray-600 italic">No details provided</p>}
                        {task.tags?.length > 0 && (
                          <div className="flex gap-1 pt-1">
                            {task.tags.map((tag) => (
                              <span key={tag} className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px]">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {data.tasks?.length === 0 && <p className="text-xs text-gray-600">No tasks for today</p>}
              </div>
            </div>

            {/* Active agents */}
            <div className="bg-surface rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-3">Active Agents</h3>
              <div className="grid grid-cols-2 gap-2">
                {data.agents?.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 p-2 rounded bg-surface-light">
                    <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : agent.status === 'idle' ? 'bg-gray-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-gray-300">{agent.name}</span>
                    <span className="text-[10px] text-gray-600 ml-auto">{agent.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
