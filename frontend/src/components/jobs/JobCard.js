export default function JobCard({ job }) {
  const daysAgo = Math.floor((Date.now() - new Date(job.postedDate).getTime()) / 86400000);

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <div>
        <div className="text-sm text-white font-medium">{job.title}</div>
        <div className="text-xs text-gray-500">{job.company} - {job.location}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold ${job.matchScore >= 90 ? 'text-green-400' : job.matchScore >= 80 ? 'text-blue-400' : 'text-gray-400'}`}>
          {job.matchScore}%
        </span>
        <span className="text-[10px] text-gray-600">{daysAgo}d ago</span>
      </div>
    </div>
  );
}
