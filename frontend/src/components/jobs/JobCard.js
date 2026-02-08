import { useState, useEffect } from 'react';

export default function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false);
  const [daysAgo, setDaysAgo] = useState('');

  useEffect(() => {
    setDaysAgo(Math.floor((Date.now() - new Date(job.postedDate).getTime()) / 86400000));
  }, [job.postedDate]);

  return (
    <div
      className="py-2 border-b border-gray-800 last:border-0 cursor-pointer hover:bg-surface-light px-2 -mx-2 rounded transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white font-medium">{job.title}</div>
          <div className="text-xs text-gray-500">{job.company} - {job.location}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${job.matchScore >= 90 ? 'text-green-400' : job.matchScore >= 80 ? 'text-blue-400' : 'text-gray-400'}`}>
            {job.matchScore}%
          </span>
          <span className="text-[10px] text-gray-600">{daysAgo !== '' ? `${daysAgo}d ago` : ''}</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 pl-1">
          {job.summary && (
            <p className="text-xs text-gray-400 mb-2">{job.summary}</p>
          )}
          {job.url && job.url !== '#' ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
            >
              View listing &rarr;
            </a>
          ) : (
            <span className="text-xs text-gray-600">No link available</span>
          )}
        </div>
      )}
    </div>
  );
}
