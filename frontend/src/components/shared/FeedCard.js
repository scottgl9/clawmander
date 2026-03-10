import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AGENT_COLORS = {
  'work-agent': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'personal-agent': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'budget': 'bg-green-500/20 text-green-400 border-green-500/30',
  'job-search': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'sentinel-work': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'sentinel-personal': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'work-code-reviewer': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'jira-agent': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function FeedCard({ run, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const agentColor = AGENT_COLORS[run.agentId] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  const preview = run.summary
    ? run.summary.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').slice(0, 120)
    : null;

  return (
    <div className="bg-surface rounded-lg border border-gray-800 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-light transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${agentColor}`}>
            {run.agentId}
          </span>
          {!compact && run.jobName && (
            <span className="text-sm text-gray-300 truncate">{run.jobName}</span>
          )}
          {compact && preview && (
            <span className="text-xs text-gray-500 truncate">{preview}</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          {run.status === 'ok' ? (
            <span className="w-2 h-2 rounded-full bg-green-500" title="Success" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-red-500" title="Error" />
          )}
          <span className="text-xs text-gray-600 whitespace-nowrap">{timeAgo(run.ts)}</span>
          <span className={`text-accent transition-transform text-xs ${expanded ? 'rotate-90' : ''}`}>{'>'}</span>
        </div>
      </div>

      {expanded && run.summary && (
        <div className="px-4 pb-4 border-t border-gray-800">
          <div className="mt-3 prose prose-invert prose-sm max-w-none text-gray-300
            prose-headings:text-white prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
            prose-p:my-1 prose-ul:my-1 prose-li:my-0
            prose-code:text-accent prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-table:text-sm prose-th:text-left prose-th:text-gray-400 prose-td:text-gray-300
            prose-hr:border-gray-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.summary}</ReactMarkdown>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-600">
            {run.durationMs && <span>{Math.round(run.durationMs / 1000)}s</span>}
            {run.model && <span>{run.model}</span>}
            {run.usage && <span>{run.usage.total_tokens?.toLocaleString()} tokens</span>}
            {run.ts && <span>{new Date(run.ts).toLocaleString()}</span>}
          </div>
        </div>
      )}

      {expanded && run.error && !run.summary && (
        <div className="px-4 pb-4 border-t border-gray-800">
          <p className="mt-3 text-sm text-red-400">{run.error}</p>
        </div>
      )}
    </div>
  );
}
