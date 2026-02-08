import { useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import { StatusBadge, PriorityBadge } from '../components/shared/Badge';
import TaskDetailModal from '../components/shared/TaskDetailModal';

export default function CompletedView() {
  const connected = useSSE(() => {});
  const { data: tasks, loading, error } = useAPI(() => api.tasks.getAll({ status: 'done' }));
  const [selectedTask, setSelectedTask] = useState(null);

  const sorted = tasks
    ? [...tasks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    : [];

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-1">Completed Tasks</h2>
        <p className="text-sm text-gray-500 mb-6">{sorted.length} task{sorted.length !== 1 ? 's' : ''} completed</p>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && sorted.length === 0 && !error && (
          <p className="text-xs text-gray-600">No completed tasks yet</p>
        )}

        {sorted.length > 0 && (
          <div className="bg-surface rounded-lg p-4 border border-gray-800">
            <div className="space-y-2">
              {sorted.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 cursor-pointer hover:bg-surface-light px-2 -mx-2 rounded transition-colors"
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={task.status} />
                    <span className="text-sm text-gray-300">{task.title}</span>
                    {task.agentId && (
                      <span className="text-[10px] text-gray-600">{task.agentId}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    {task.updatedAt && (
                      <span className="text-[10px] text-gray-600">
                        {new Date(task.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      </div>
    </Layout>
  );
}
