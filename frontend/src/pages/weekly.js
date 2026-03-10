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

export default function WeeklyView() {
  const connected = useSSE(() => {});
  const { data: weeksData, loading: weeksLoading } = useAPI(() => api.memory.getWeeks(12));
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [loadingWeek, setLoadingWeek] = useState(false);

  // Auto-select latest week when data loads
  useEffect(() => {
    if (weeksData?.length > 0 && !selectedWeek) {
      setSelectedWeek(weeksData[0].weekId);
    }
  }, [weeksData, selectedWeek]);

  // Load week data when selection changes
  useEffect(() => {
    if (!selectedWeek) return;
    setLoadingWeek(true);
    api.memory.getWeek(selectedWeek)
      .then(data => {
        setWeekData(data);
        if (data.agents?.length > 0) {
          setActiveTab(data.agents[0]);
        }
        setLoadingWeek(false);
      })
      .catch(() => setLoadingWeek(false));
  }, [selectedWeek]);

  const weekMeta = weeksData?.find(w => w.weekId === selectedWeek);

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
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
                  {w.weekId} ({w.agentCount} agent{w.agentCount !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          )}
        </div>

        {weeksLoading && <p className="text-gray-600">Loading...</p>}

        {weekMeta && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface rounded-lg p-4 border border-gray-800 text-center">
              <div className="text-3xl font-bold text-white">{weekMeta.agentCount}</div>
              <div className="text-xs text-gray-500">Agents Reporting</div>
            </div>
            <div className="bg-surface rounded-lg p-4 border border-gray-800 text-center">
              <div className="text-3xl font-bold text-accent">{selectedWeek}</div>
              <div className="text-xs text-gray-500">Week</div>
            </div>
          </div>
        )}

        {loadingWeek && <p className="text-gray-600">Loading week data...</p>}

        {weekData && weekData.agents?.length > 0 && (
          <div className="bg-surface rounded-lg border border-gray-800 overflow-hidden">
            {/* Agent tabs */}
            <div className="flex border-b border-gray-800 overflow-x-auto">
              {weekData.agents.map(agent => (
                <button
                  key={agent}
                  onClick={() => setActiveTab(agent)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === agent
                      ? 'text-white border-b-2 border-accent bg-surface-light'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-surface-light'
                  }`}
                >
                  {AGENT_LABELS[agent] || agent}
                </button>
              ))}
            </div>

            {/* Markdown content */}
            {activeTab && weekData.summaries[activeTab] && (
              <div className="p-6 prose prose-invert prose-sm max-w-none text-gray-300
                prose-headings:text-white prose-headings:font-semibold
                prose-h1:text-lg prose-h1:mt-0 prose-h1:mb-3
                prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2
                prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2
                prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                prose-code:text-accent prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded
                prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700
                prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                prose-table:text-sm prose-th:text-left prose-th:text-gray-400 prose-td:text-gray-300
                prose-hr:border-gray-700
                prose-blockquote:border-gray-600 prose-blockquote:text-gray-400">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {weekData.summaries[activeTab]}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {weekData && weekData.agents?.length === 0 && (
          <div className="bg-surface rounded-lg border border-gray-800 p-8 text-center">
            <p className="text-gray-500">No WEEK.md files found for {selectedWeek}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
