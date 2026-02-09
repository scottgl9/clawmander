import { useState } from 'react';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import SimpleMarkdown from '../shared/SimpleMarkdown';

export default function WorkBrief() {
  const { data, loading, error } = useAPI(() => api.work.getBrief());
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-2">Daily Brief</h3>
      <div className="text-xs text-gray-400 mb-3">
        <SimpleMarkdown content={data?.summary} />
      </div>
      <ul className="space-y-1">
        {data?.priorities?.map((p, i) => (
          <li key={i}>
            <button
              className="text-xs text-gray-300 flex items-center gap-2 w-full text-left hover:text-white transition-colors"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <span className={`text-accent transition-transform ${expandedIndex === i ? 'rotate-90' : ''}`}>{'>'}</span>
              <span className="flex-1">
                <SimpleMarkdown content={p.title} />
              </span>
            </button>
            {expandedIndex === i && p.details && (
              <div className="ml-5 mt-1 mb-1 text-xs text-gray-500 border-l border-gray-700 pl-2">
                <SimpleMarkdown content={p.details} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
