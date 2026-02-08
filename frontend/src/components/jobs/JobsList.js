import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import JobCard from './JobCard';

export default function JobsList() {
  const { data, loading, error } = useAPI(() => api.jobs.getRecent());

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">Recent Job Matches</h3>
      {data?.length === 0 ? (
        <p className="text-xs text-gray-600">No recent matches</p>
      ) : (
        data?.map((job) => <JobCard key={job.id} job={job} />)
      )}
    </div>
  );
}
