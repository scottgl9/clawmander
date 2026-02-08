import Modal from './Modal';
import { PriorityBadge, StatusBadge } from './Badge';
import ProgressBar from './ProgressBar';
import AgentAvatar from '../kanban/AgentAvatar';

export default function TaskDetailModal({ task, agent, isOpen, onClose }) {
  if (!task) return null;

  const createdDate = new Date(task.createdAt);
  const updatedDate = new Date(task.updatedAt);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Details">
      <div className="space-y-6">
        {/* Title & Status */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="text-xl font-semibold text-white">{task.title}</h3>
            <StatusBadge status={task.status} />
          </div>
          {task.details && (
            <p className="text-sm text-gray-300">{task.details}</p>
          )}
          {task.description && (
            <p className="text-sm text-gray-400">{task.description}</p>
          )}
        </div>

        {/* Agent & Priority */}
        <div className="grid grid-cols-2 gap-4">
          {agent && (
            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">Agent</label>
              <div className="flex items-center gap-2">
                <AgentAvatar name={agent.name} status={agent.status} />
                <div>
                  <div className="text-sm text-white">{agent.name}</div>
                  <div className="text-xs text-gray-500 capitalize">{agent.status}</div>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 uppercase mb-1 block">Priority</label>
            <PriorityBadge priority={task.priority} />
          </div>
        </div>

        {/* Progress */}
        {task.status === 'in_progress' && (
          <div>
            <label className="text-xs text-gray-500 uppercase mb-2 block">Progress</label>
            <ProgressBar value={task.progress} />
            <div className="text-right text-sm text-gray-400 mt-1">{task.progress}%</div>
          </div>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <span key={tag} className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {task.sessionKey && (
          <div className="grid grid-cols-2 gap-4">
            {task.sessionKey && (
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Session Key</label>
                <div className="text-sm text-gray-300 font-mono">{task.sessionKey}</div>
              </div>
            )}
            {task.runId && (
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Run ID</label>
                <div className="text-sm text-gray-300 font-mono">{task.runId}</div>
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
          <div>
            <label className="text-xs text-gray-500 uppercase mb-1 block">Created</label>
            <div className="text-sm text-gray-300">
              {createdDate.toLocaleDateString()}<br/>
              <span className="text-xs text-gray-500">{createdDate.toLocaleTimeString()}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase mb-1 block">Last Updated</label>
            <div className="text-sm text-gray-300">
              {updatedDate.toLocaleDateString()}<br/>
              <span className="text-xs text-gray-500">{updatedDate.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Additional Metadata */}
        {task.metadata && Object.keys(task.metadata).length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase mb-2 block">Additional Info</label>
            <div className="bg-gray-900 rounded p-3 font-mono text-xs text-gray-300">
              <pre>{JSON.stringify(task.metadata, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
