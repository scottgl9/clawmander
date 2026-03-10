import Link from 'next/link';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import FeedCard from './FeedCard';

export default function RecentFeeds({ limit = 5 }) {
  const { data, loading, error } = useAPI(() => api.feeds.getAll({ limit }));

  return (
    <div className="bg-surface rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Recent Agent Reports</h3>
        <Link href="/feeds" className="text-xs text-accent hover:text-accent/80 transition-colors">
          View all &rarr;
        </Link>
      </div>

      {loading && <p className="text-xs text-gray-600">Loading...</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {data?.runs && (
        <div className="space-y-2">
          {data.runs.map((run, i) => (
            <FeedCard key={`${run.jobId}-${run.tsMs}-${i}`} run={run} compact />
          ))}
          {data.runs.length === 0 && (
            <p className="text-xs text-gray-600">No recent reports</p>
          )}
        </div>
      )}
    </div>
  );
}
