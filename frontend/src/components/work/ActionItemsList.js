import { useState } from 'react';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import SimpleMarkdown from '../shared/SimpleMarkdown';

const TITLES = {
  personal: 'Personal Items',
  work: 'Work Items',
};

const FETCHERS = {
  personal: () => api.work.getPersonalItems(),
  work: () => api.work.getWorkItems(),
};

export default function ActionItemsList({ category }) {
  const fetcher = FETCHERS[category] || (() => api.work.getActionItems());
  const { data, loading, error } = useAPI(fetcher);
  const [expandedId, setExpandedId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;

  // Filter out completed items
  const activeItems = data?.filter(item => !item.done) || [];

  // Show top 5 by default, up to 15 when expanded
  const displayItems = showAll ? activeItems.slice(0, 15) : activeItems.slice(0, 5);
  const hasMore = activeItems.length > 5;
  const hiddenCount = activeItems.length - displayItems.length;

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">{TITLES[category] || 'Action Items'}</h3>
      <ul className="space-y-2">
        {displayItems.map((item) => (
          <li key={item.id}>
            <button
              className="flex items-start gap-2 w-full text-left"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <span className={`mt-0.5 w-3 h-3 rounded border flex-shrink-0 ${item.done ? 'bg-green-500 border-green-500' : 'border-gray-600'}`} />
              <span className={`text-sm ${item.done ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                <SimpleMarkdown content={item.title} />
              </span>
            </button>
            {expandedId === item.id && (item.details || item.description) && (
              <div className="ml-5 mt-1 text-xs text-gray-400 border-l border-gray-700 pl-3 py-1">
                <SimpleMarkdown content={item.details || item.description} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {showAll ? 'Show less' : `Show ${hiddenCount} more...`}
        </button>
      )}
    </div>
  );
}
