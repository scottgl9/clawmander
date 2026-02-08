import Link from 'next/link';
import Layout from '../../components/layout/Layout';
import { useAPI } from '../../hooks/useAPI';
import { useSSE } from '../../hooks/useSSE';
import { api } from '../../lib/api';

function CompletedTabs({ active }) {
  return (
    <div className="flex gap-4 mb-6 border-b border-gray-800">
      <Link href="/completed/agent" className={`pb-2 text-sm font-medium transition-colors ${active === 'agent' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
        Agent Tasks
      </Link>
      <Link href="/completed/mine" className={`pb-2 text-sm font-medium transition-colors ${active === 'mine' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
        My Items
      </Link>
    </div>
  );
}

export default function CompletedMineView() {
  const connected = useSSE(() => {});
  const { data: items, loading, error } = useAPI(() => api.work.getCompletedItems());

  const grouped = {};
  if (items) {
    for (const item of items) {
      const cat = item.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }
  }

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-1">Completed</h2>
        <p className="text-sm text-gray-500 mb-4">{items ? items.length : 0} action item{items?.length !== 1 ? 's' : ''} completed</p>

        <CompletedTabs active="mine" />

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && (!items || items.length === 0) && !error && (
          <p className="text-xs text-gray-600">No completed action items yet</p>
        )}

        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{category}</h3>
            <div className="bg-surface rounded-lg p-4 border border-gray-800">
              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 px-2 -mx-2"
                  >
                    <div className="flex items-center gap-3">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-gray-300">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600">{item.priority}</span>
                      {item.updatedAt && (
                        <span className="text-[10px] text-gray-600">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
