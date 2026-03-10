import { useState, useEffect } from 'react';
import AgentAvatar from './AgentAvatar';
import ProgressBar from '../shared/ProgressBar';
import { PriorityBadge } from '../shared/Badge';

function shortSessionKey(sessionKey) {
  if (!sessionKey) return null;
  const parts = sessionKey.split(':');
  if (parts[0] === 'agent' && parts.length >= 3) {
    const rest = parts.slice(2);
    if (rest[0] === 'clawmander') return `clawmander:${rest[1] || ''}`;
    if (rest.length >= 2) return `${rest[0]}:${rest[1]}`;
    return rest[0];
  }
  return sessionKey.slice(0, 24);
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function ElapsedTimer({ since }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(since).getTime());

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - new Date(since).getTime()), 1000);
    return () => clearInterval(id);
  }, [since]);

  return (
    <span className="text-[10px] font-mono text-green-500 tabular-nums" title="Elapsed time">
      {formatElapsed(elapsed)}
    </span>
  );
}

export default function KanbanCard({ task, agent, onClick }) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (task.updatedAt) {
      setTimeAgo(formatTimeAgo(new Date(task.updatedAt)));
    }
  }, [task.updatedAt]);

  const sessionLabel = shortSessionKey(task.sessionKey);

  return (
    <div
      className="bg-surface-light rounded-lg p-3 mb-2 border border-gray-800 hover:border-gray-600 transition-colors cursor-pointer"
      onClick={() => onClick && onClick(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white leading-tight truncate">{task.title}</h4>
          {task.agentType === 'subagent' && (
            <span className="flex-shrink-0 px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[9px] font-medium">sub</span>
          )}
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      {sessionLabel && (
        <p className="text-[10px] text-gray-600 mb-2 truncate" title={task.sessionKey}>
          {sessionLabel}
        </p>
      )}

      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      {task.status === 'in_progress' && task.progress > 0 && (
        <div className="mb-2">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[10px] text-gray-500">Progress</span>
            <span className="text-[10px] text-gray-400">{task.progress}%</span>
          </div>
          <ProgressBar value={task.progress} />
        </div>
      )}

      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded text-[10px]">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
        <div className="flex items-center gap-2">
          {agent && <AgentAvatar name={agent.name} status={agent.status} />}
          {task.status === 'in_progress' && task.createdAt && (
            <ElapsedTimer since={task.createdAt} />
          )}
        </div>
        <span className="text-[10px] text-gray-600">{timeAgo}</span>
      </div>
    </div>
  );
}

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
