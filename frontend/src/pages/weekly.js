import { useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import { StatusBadge } from '../components/shared/Badge';

export default function WeeklyView() {
  const connected = useSSE(() => {});
  const { data, loading, error } = useAPI(() => api.views.getWeekly());
  const [expandedId, setExpandedId] = useState(null);

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-1">Weekly View</h2>
        <p className="text-sm text-gray-500 mb-6">
          {data ? `${data.startDate} - ${data.endDate}` : 'This week'}
        </p>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface rounded-lg p-4 border border-gray-800 text-center">
                <div className="text-3xl font-bold text-white">{data.tasks?.length || 0}</div>
                <div className="text-xs text-gray-500">Total Tasks</div>
              </div>
              <div className="bg-surface rounded-lg p-4 border border-gray-800 text-center">
                <div className="text-3xl font-bold text-green-400">{data.completedThisWeek || 0}</div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div className="bg-surface rounded-lg p-4 border border-gray-800 text-center">
                <div className="text-3xl font-bold text-blue-400">{data.agents?.length || 0}</div>
                <div className="text-xs text-gray-500">Agents</div>
              </div>
            </div>

            <div className="bg-surface rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-3">This Week&apos;s Tasks</h3>
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
                      <span className="text-xs text-gray-600">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
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
                {data.tasks?.length === 0 && <p className="text-xs text-gray-600">No tasks this week</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
