import { useState, useEffect } from 'react';
import AgentAvatar from './AgentAvatar';
import HeartbeatTimer from './HeartbeatTimer';
import ProgressBar from '../shared/ProgressBar';
import { PriorityBadge } from '../shared/Badge';

export default function KanbanCard({ task, agent, heartbeat, onClick }) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (task.updatedAt) {
      setTimeAgo(formatTimeAgo(new Date(task.updatedAt)));
    }
  }, [task.updatedAt]);

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
          {heartbeat && (
            <HeartbeatTimer
              nextHeartbeat={heartbeat.nextHeartbeat}
              heartbeatInterval={heartbeat.heartbeatInterval}
            />
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
