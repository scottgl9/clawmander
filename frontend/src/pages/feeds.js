import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import FeedCard from '../components/shared/FeedCard';

const AGENTS = [
  { value: '', label: 'All Agents' },
  { value: 'work-agent', label: 'Work Agent' },
  { value: 'personal-agent', label: 'Personal Agent' },
  { value: 'budget', label: 'Budget' },
  { value: 'job-search', label: 'Job Search' },
  { value: 'sentinel-work', label: 'Sentinel (Work)' },
  { value: 'sentinel-personal', label: 'Sentinel (Personal)' },
  { value: 'work-code-reviewer', label: 'Code Reviewer' },
  { value: 'jira-agent', label: 'Jira Agent' },
];

const PAGE_SIZE = 25;

export default function FeedsPage() {
  const [agentFilter, setAgentFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const { data, loading, error, reload } = useAPI(
    () => api.feeds.getAll({ limit: PAGE_SIZE, offset, ...(agentFilter ? { agent: agentFilter } : {}) }),
    [agentFilter, offset]
  );

  const connected = useSSE(useCallback((event) => {
    if (event.type === 'feed.new') reload();
  }, [reload]));

  const handleAgentChange = (e) => {
    setAgentFilter(e.target.value);
    setOffset(0);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Feeds</h2>
            <p className="text-sm text-gray-500">Agent reports and cron run output</p>
          </div>
          <select
            value={agentFilter}
            onChange={handleAgentChange}
            className="bg-surface border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
          >
            {AGENTS.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {data?.runs && (
          <div className="space-y-2">
            {data.runs.map((run, i) => (
              <FeedCard key={`${run.jobId}-${run.tsMs}-${i}`} run={run} />
            ))}
            {data.runs.length === 0 && (
              <div className="bg-surface rounded-lg border border-gray-800 p-8 text-center">
                <p className="text-gray-500">No reports found</p>
              </div>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="text-sm text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
            >
              &larr; Newer
            </button>
            <span className="text-xs text-gray-600">
              Page {currentPage} of {totalPages} ({data.total} total)
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= data.total}
              className="text-sm text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
            >
              Older &rarr;
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
