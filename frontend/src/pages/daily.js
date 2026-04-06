import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import { PriorityBadge } from '../components/shared/Badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import WorkBrief from '../components/work/WorkBrief';

const taskMdComponents = {
  p: ({ children }) => <p className="text-gray-300 leading-relaxed mb-1 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-200">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-400">{children}</em>,
  ul: ({ children }) => <ul className="mt-1 mb-1 space-y-0.5 pl-3">{children}</ul>,
  ol: ({ children }) => <ol className="mt-1 mb-1 space-y-0.5 pl-3 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="list-disc text-gray-300">{children}</li>,
  code: ({ children }) => (
    <code className="px-1 py-0.5 bg-gray-800 text-green-400 rounded font-mono text-[10px]">{children}</code>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{children}</a>
  ),
};

const PRIORITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

function sortByPriority(items) {
  return [...items].sort((a, b) => (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0));
}

function DailyTaskItem({ task, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState(!!task.completed);
  const [toggling, setToggling] = useState(false);

  const handleCheck = useCallback(async (e) => {
    e.stopPropagation();
    const next = !checked;
    setChecked(next);
    setToggling(true);
    try {
      await api.work.toggleDailyTask(task.id, next);
      if (onToggle) onToggle(task.id, next);
    } catch {
      setChecked(!next); // revert on error
    } finally {
      setToggling(false);
    }
  }, [checked, task.id, onToggle]);

  return (
    <div className={`border-b border-gray-800 last:border-0 ${checked ? 'opacity-50' : ''}`}>
      <div
        className="flex items-center gap-3 py-2 px-2 -mx-2 rounded hover:bg-surface-light cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Checkbox */}
        <button
          onClick={handleCheck}
          disabled={toggling}
          className={`flex-shrink-0 w-4 h-4 rounded border ${checked ? 'bg-green-600 border-green-600' : 'border-gray-600 hover:border-gray-400'} flex items-center justify-center transition-colors`}
          title={checked ? 'Mark incomplete' : 'Mark complete'}
        >
          {checked && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
            </svg>
          )}
        </button>

        {/* Title */}
        <span className={`flex-1 text-sm ${checked ? 'line-through text-gray-500' : 'text-gray-300'}`}>
          {task.title}
        </span>

        {/* Priority + expand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <PriorityBadge priority={task.priority} />
          <span className={`text-gray-600 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
        </div>
      </div>

      {expanded && (
        <div className="ml-7 mt-1 mb-2 text-xs border-l border-gray-700 pl-3 space-y-1">
          {task.description
            ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={taskMdComponents}>{task.description}</ReactMarkdown>
            : <p className="text-gray-600 italic">No details</p>}
        </div>
      )}
    </div>
  );
}

function ActionItemList({ items, label }) {
  if (!items || items.length === 0) return null;
  const sorted = sortByPriority(items.filter(i => !i.completed));
  if (sorted.length === 0) return null;
  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">{label}</h3>
      <div className="space-y-0">
        {sorted.map(item => (
          <div key={item.id} className="flex items-start gap-2 py-2 border-b border-gray-800 last:border-0">
            <div className="flex-shrink-0 mt-0.5">
              <PriorityBadge priority={item.priority} />
            </div>
            <span className="text-sm text-gray-300 leading-snug">{item.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DailyView() {
  const connected = useSSE(() => {});
  const { data, loading, error } = useAPI(() => api.views.getDaily());
  const [taskStates, setTaskStates] = useState({});

  const handleToggle = useCallback((id, completed) => {
    setTaskStates(prev => ({ ...prev, [id]: completed }));
  }, []);

  const tasks = data?.tasks || [];
  const pending = tasks.filter(t => !(taskStates[t.id] ?? t.completed));
  const done = tasks.filter(t => taskStates[t.id] ?? t.completed);

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Daily View</h2>
          <span className="text-sm text-gray-500">{data?.date || 'Today'}</span>
        </div>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {data && (
          <div className="space-y-4">
            {/* Daily Brief */}
            <WorkBrief />

            {/* Stats row */}
            {tasks.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface rounded-lg p-3 border border-gray-800 text-center">
                  <div className="text-2xl font-bold text-white">{tasks.length}</div>
                  <div className="text-xs text-gray-500">Total Tasks</div>
                </div>
                <div className="bg-surface rounded-lg p-3 border border-gray-800 text-center">
                  <div className="text-2xl font-bold text-orange-400">{pending.length}</div>
                  <div className="text-xs text-gray-500">Remaining</div>
                </div>
                <div className="bg-surface rounded-lg p-3 border border-gray-800 text-center">
                  <div className="text-2xl font-bold text-green-400">{done.length}</div>
                  <div className="text-xs text-gray-500">Done</div>
                </div>
              </div>
            )}

            {/* Today's Tasks (checkable) */}
            <div className="bg-surface rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-3">
                Today&apos;s Tasks
                {tasks.length > 0 && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    {done.length}/{tasks.length} done
                  </span>
                )}
              </h3>
              <div className="space-y-0">
                {sortByPriority(pending).map(task => (
                  <DailyTaskItem key={task.id} task={task} onToggle={handleToggle} />
                ))}
                {done.length > 0 && (
                  <>
                    {pending.length > 0 && <div className="border-t border-gray-700 my-2" />}
                    {done.map(task => (
                      <DailyTaskItem key={task.id} task={{ ...task, completed: true }} onToggle={handleToggle} />
                    ))}
                  </>
                )}
                {tasks.length === 0 && <p className="text-xs text-gray-600">No tasks for today</p>}
              </div>
            </div>

            {/* Work action items */}
            <ActionItemList items={data.work} label="Work Priorities" />

            {/* Personal action items */}
            <ActionItemList items={data.personal} label="Personal Priorities" />

            {/* Active agents */}
            {data.agents?.length > 0 && (
              <div className="bg-surface rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-3">Active Agents</h3>
                <div className="grid grid-cols-2 gap-2">
                  {data.agents.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-2 p-2 rounded bg-surface-light">
                      <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : agent.status === 'idle' ? 'bg-gray-500' : 'bg-red-500'}`} />
                      <span className="text-sm text-gray-300">{agent.name}</span>
                      <span className="text-[10px] text-gray-600 ml-auto">{agent.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
