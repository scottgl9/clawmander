import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AGENT_LABELS = {
  'work-agent': 'Work Agent',
  'personal-agent': 'Personal Agent',
  'sentinel-work': 'Sentinel (Work)',
  'budget': 'Budget',
  'job-search': 'Job Search',
  'work-code-reviewer': 'Code Reviewer',
  'jira-agent': 'Jira Agent',
};

// Custom markdown components tuned for WEEK.md structure
const mdComponents = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-white mt-0 mb-4 pb-2 border-b border-gray-700">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-accent uppercase tracking-wide mt-8 mb-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-200 mt-5 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-medium text-gray-300 mt-3 mb-1">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-gray-300 text-sm leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 space-y-1 pl-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 space-y-1 pl-4 list-decimal">{children}</ol>
  ),
  li: ({ children, className }) => {
    const isTask = className === 'task-list-item';
    return (
      <li className={`text-sm text-gray-300 leading-relaxed ${isTask ? 'list-none -ml-4 flex items-start gap-2' : 'list-disc'}`}>
        {children}
      </li>
    );
  },
  input: ({ checked, disabled }) => (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 mt-0.5 ${
      checked
        ? 'bg-accent border-accent text-white'
        : 'border-gray-600 bg-gray-800'
    }`}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
        </svg>
      )}
    </span>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 px-4 py-2.5 bg-gray-800/60 border border-gray-700 rounded-lg text-sm text-gray-400 [&_p]:mb-0 [&_strong]:text-gray-300">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="border-gray-800 my-6" />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4 rounded-lg border border-gray-700">
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
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-gray-300 align-top">{children}</td>
  ),
  code: ({ children }) => (
    <code className="px-1.5 py-0.5 bg-gray-800 text-green-400 rounded text-xs font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 my-3 overflow-x-auto text-xs font-mono text-green-400 leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-400">{children}</em>
  ),
};

export default function WeeklyView() {
  const connected = useSSE(() => {});
  const { data: weeksData, loading: weeksLoading } = useAPI(() => api.memory.getWeeks(12));
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [loadingWeek, setLoadingWeek] = useState(false);

  useEffect(() => {
    if (weeksData?.length > 0 && !selectedWeek) {
      setSelectedWeek(weeksData[0].weekId);
    }
  }, [weeksData, selectedWeek]);

  useEffect(() => {
    if (!selectedWeek) return;
    setLoadingWeek(true);
    api.memory.getWeek(selectedWeek)
      .then(data => {
        setWeekData(data);
        if (data.agents?.length > 0) setActiveTab(data.agents[0]);
        setLoadingWeek(false);
      })
      .catch(() => setLoadingWeek(false));
  }, [selectedWeek]);

  return (
    <Layout connected={connected}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Weekly Summaries</h2>
            <p className="text-sm text-gray-500">WEEK.md reports from all agents</p>
          </div>
          {weeksData && (
            <select
              value={selectedWeek || ''}
              onChange={(e) => { setSelectedWeek(e.target.value); setActiveTab(null); }}
              className="bg-surface border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
            >
              {weeksData.map(w => (
                <option key={w.weekId} value={w.weekId}>
                  {w.weekId} — {w.agentCount} agent{w.agentCount !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {(weeksLoading || loadingWeek) && (
          <p className="text-gray-600 text-sm">Loading...</p>
        )}

        {/* Tab + content panel */}
        {weekData && weekData.agents?.length > 0 && (
          <div className="bg-surface rounded-xl border border-gray-800 overflow-hidden">
            {/* Agent tabs */}
            <div className="flex border-b border-gray-800 overflow-x-auto bg-gray-900/50">
              {weekData.agents.map(agent => (
                <button
                  key={agent}
                  onClick={() => setActiveTab(agent)}
                  className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === agent
                      ? 'text-white border-accent bg-surface'
                      : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-surface/50'
                  }`}
                >
                  {AGENT_LABELS[agent] || agent}
                </button>
              ))}
            </div>

            {/* Markdown body */}
            {activeTab && weekData.summaries[activeTab] && (
              <div className="px-8 py-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {weekData.summaries[activeTab]}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {weekData && weekData.agents?.length === 0 && (
          <div className="bg-surface rounded-xl border border-gray-800 p-8 text-center">
            <p className="text-gray-500 text-sm">No WEEK.md files found for {selectedWeek}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
