import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useSSE } from '../../hooks/useSSE';
import { KANBAN_COLUMNS } from '../../lib/constants';
import KanbanColumn from './KanbanColumn';
import TaskDetailModal from '../shared/TaskDetailModal';

export default function KanbanBoard({ onConnectionChange } = {}) {
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [heartbeats, setHeartbeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [t, a, h] = await Promise.all([
        api.tasks.getAll(),
        api.agents.getStatus(),
        api.agents.getHeartbeat(),
      ]);
      setTasks(t);
      setAgents(a);
      setHeartbeats(h);
    } catch (err) {
      console.error('Failed to load kanban data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const connected = useSSE((event) => {
    switch (event.type) {
      case 'task.created':
        setTasks((prev) => [...prev, event.data]);
        break;
      case 'task.updated':
        // event.data IS the full task object
        setTasks((prev) =>
          prev.map((t) => (t.id === event.data.id ? { ...t, ...event.data } : t))
        );
        break;
      case 'task.status_changed':
        // event.data = { taskId, from, to, task } — use nested .task
        if (event.data.task) {
          setTasks((prev) =>
            prev.map((t) => (t.id === event.data.task.id ? { ...t, ...event.data.task } : t))
          );
        }
        break;
      case 'task.deleted':
        setTasks((prev) => prev.filter((t) => t.id !== event.data.taskId));
        break;
      case 'agent.status_changed':
        setAgents((prev) => {
          const exists = prev.find((a) => a.id === event.data.agentId);
          if (exists) return prev.map((a) => (a.id === event.data.agentId ? { ...a, ...event.data.agent } : a));
          return event.data.agent ? [...prev, event.data.agent] : prev;
        });
        break;
      case 'heartbeat.received':
        loadData();
        break;
    }
  });

  // Relay connection state to parent
  useEffect(() => {
    if (onConnectionChange) onConnectionChange(connected);
  }, [connected, onConnectionChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 text-sm">Loading tasks...</div>
      </div>
    );
  }

  const handleTaskClick = (task) => {
    setSelectedTask(task);
  };

  const selectedAgent = selectedTask ? agents.find(a => a.id === selectedTask.agentId) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Agent Tasks</h2>
        <div className="text-xs text-gray-500">{tasks.length} tasks</div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map(({ key, label }) => (
          <KanbanColumn
            key={key}
            status={key}
            label={label}
            tasks={tasks.filter((t) => t.status === key)}
            agents={agents}
            heartbeats={heartbeats}
            onTaskClick={handleTaskClick}
          />
        ))}
      </div>

      {tasks.filter((t) => t.status === 'done').length > 0 && (
        <div className="mt-3 text-center">
          <Link href="/completed/agent">
            <span className="text-xs text-green-400 hover:text-green-300 cursor-pointer transition-colors">
              {tasks.filter((t) => t.status === 'done').length} completed task{tasks.filter((t) => t.status === 'done').length !== 1 ? 's' : ''} &rarr;
            </span>
          </Link>
        </div>
      )}

      <TaskDetailModal
        task={selectedTask}
        agent={selectedAgent}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
