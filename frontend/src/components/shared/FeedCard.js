import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const mdComponents = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-white mt-0 mb-3 pb-2 border-b border-gray-700">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xs font-semibold text-accent uppercase tracking-wide mt-6 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-200 mt-4 mb-1.5">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-medium text-gray-300 mt-3 mb-1">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-gray-300 text-sm leading-relaxed mb-2">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 space-y-0.5 pl-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 space-y-0.5 pl-4 list-decimal">{children}</ol>
  ),
  li: ({ children, className }) => {
    const isTask = className === 'task-list-item';
    return (
      <li className={`text-sm text-gray-300 leading-relaxed ${isTask ? 'list-none -ml-4 flex items-start gap-2' : 'list-disc'}`}>
        {children}
      </li>
    );
  },
  input: ({ checked }) => (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 mt-0.5 ${
      checked ? 'bg-accent border-accent text-white' : 'border-gray-600 bg-gray-800'
    }`}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
        </svg>
      )}
    </span>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-lg text-sm text-gray-400 [&_p]:mb-0 [&_strong]:text-gray-300">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-gray-800 my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 rounded-lg border border-gray-700">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-800 border-b border-gray-700">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-800">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-gray-800/40 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-300 align-top">{children}</td>
  ),
  code: ({ children }) => (
    <code className="px-1.5 py-0.5 bg-gray-800 text-green-400 rounded text-xs font-mono">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-green-400 leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-400">{children}</em>,
};

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
        <div className="px-5 pb-5 border-t border-gray-800">
          <div className="mt-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {run.summary}
            </ReactMarkdown>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center gap-4 text-[11px] text-gray-600">
            {run.durationMs && <span>{Math.round(run.durationMs / 1000)}s</span>}
            {(run.provider || run.model) && (
              <span>{run.provider && run.model ? `${run.provider}/${run.model}` : (run.model || run.provider)}</span>
            )}
            {run.usage?.total_tokens && <span>{run.usage.total_tokens.toLocaleString()} tokens</span>}
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
