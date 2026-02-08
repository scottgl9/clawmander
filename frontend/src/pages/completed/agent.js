import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/layout/Layout';
import { useAPI } from '../../hooks/useAPI';
import { useSSE } from '../../hooks/useSSE';
import { api } from '../../lib/api';
import { StatusBadge, PriorityBadge } from '../../components/shared/Badge';
import TaskDetailModal from '../../components/shared/TaskDetailModal';

function CompletedTabs({ active }) {
  return (
    <div className="flex gap-4 mb-6 border-b border-gray-800">
      <Link href="/completed/agent" className={`pb-2 text-sm font-medium transition-colors ${active === 'agent' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
        Agent Tasks
      </Link>
      <Link href="/completed/mine" className={`pb-2 text-sm font-medium transition-colors ${active === 'mine' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
        My Items
      </Link>
    </div>
  );
}

export default function CompletedAgentView() {
  const connected = useSSE(() => {});
  const { data: tasks, loading, error } = useAPI(() => api.tasks.getAll({ status: 'done' }));
  const [selectedTask, setSelectedTask] = useState(null);

  const sorted = tasks
    ? [...tasks].filter((t) => t.agentId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    : [];

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-1">Completed</h2>
        <p className="text-sm text-gray-500 mb-4">{sorted.length} agent task{sorted.length !== 1 ? 's' : ''} completed</p>

        <CompletedTabs active="agent" />

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && sorted.length === 0 && !error && (
          <p className="text-xs text-gray-600">No completed agent tasks yet</p>
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
                    {task.agentType === 'subagent' && (
                      <span className="px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[9px] font-medium">sub</span>
                    )}
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
