import { useState } from 'react';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import FeedCard from './FeedCard';

function timeAgo(isoString) {
  if (!isoString) return 'never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function timeUntil(isoString) {
  if (!isoString) return '';
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d`;
}

export default function CronMonitor({ refreshKey }) {
  const { data: jobs, loading, error } = useAPI(() => api.cron.getJobs(), [refreshKey]);
  const [expandedId, setExpandedId] = useState(null);
  const [runHistory, setRunHistory] = useState({});

  const toggleExpand = async (jobId) => {
    if (expandedId === jobId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(jobId);
    if (!runHistory[jobId]) {
      try {
        const runs = await api.cron.getJobRuns(jobId, 3);
        setRunHistory(prev => ({ ...prev, [jobId]: runs }));
      } catch {}
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Cron Jobs</h3>

      {loading && <p className="text-xs text-gray-600">Loading...</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {jobs && (
        <div className="space-y-1">
          {jobs.map(job => (
            <div key={job.id}>
              <div
                className="flex items-center justify-between py-2 px-2 -mx-2 rounded cursor-pointer hover:bg-surface-light transition-colors"
                onClick={() => toggleExpand(job.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    !job.enabled ? 'bg-gray-600' :
                    job.lastStatus === 'ok' ? 'bg-green-500' :
                    job.lastStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  <span className="text-sm text-gray-300 truncate">{job.name}</span>
                  {!job.enabled && (
                    <span className="text-[10px] text-gray-600 px-1.5 py-0.5 bg-gray-800 rounded">off</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  {job.consecutiveErrors > 0 && (
                    <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                      {job.consecutiveErrors} err{job.consecutiveErrors > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-600" title="Last run">
                    {timeAgo(job.lastRun)}
                  </span>
                  <span className={`text-accent transition-transform text-xs ${expandedId === job.id ? 'rotate-90' : ''}`}>{'>'}</span>
                </div>
              </div>

              {expandedId === job.id && (
                <div className="ml-4 mb-2 pl-3 border-l border-gray-700 space-y-2">
                  <div className="flex gap-4 text-[11px] text-gray-500">
                    <span>Agent: {job.agentId}</span>
                    <span>Next: {timeUntil(job.nextRun)}</span>
                    {job.schedule?.expr && <span>Cron: {job.schedule.expr}</span>}
                  </div>
                  {runHistory[job.id] && runHistory[job.id].length > 0 && (
                    <div className="space-y-1">
                      {runHistory[job.id].map((run, i) => (
                        <FeedCard key={`${run.jobId}-${run.tsMs}-${i}`} run={run} compact />
                      ))}
                    </div>
                  )}
                  {runHistory[job.id] && runHistory[job.id].length === 0 && (
                    <p className="text-[11px] text-gray-600">No run history</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
