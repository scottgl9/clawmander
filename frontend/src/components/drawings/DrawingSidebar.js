import { useState } from 'react';

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DrawingSidebar({ drawings, loading, activeId, onSelect, onCreate, onDelete, onRename }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const startRename = (drawing) => {
    setRenamingId(drawing.id);
    setRenameValue(drawing.title);
  };

  const submitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="w-full md:w-60 bg-surface-light border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Drawings</h2>
        <button
          onClick={onCreate}
          className="text-accent hover:text-accent/80 transition-colors"
          title="New drawing"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {/* Drawing list */}
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-xs text-gray-600 px-3 py-2">Loading...</p>}

        {!loading && drawings.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-gray-600 mb-2">No drawings yet</p>
            <button
              onClick={onCreate}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              Create your first drawing
            </button>
          </div>
        )}

        {drawings.map((drawing) => (
          <div
            key={drawing.id}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-800/50 transition-colors ${
              activeId === drawing.id ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-surface-lighter'
            }`}
            onClick={() => onSelect(drawing.id)}
          >
            <div className="flex-1 min-w-0">
              {renamingId === drawing.id ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="w-full bg-surface border border-gray-700 rounded px-1.5 py-0.5 text-sm text-white outline-none focus:border-accent"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <p className="text-sm text-gray-300 truncate">{drawing.title}</p>
                  <p className="text-[11px] text-gray-600" suppressHydrationWarning>{timeAgo(drawing.updatedAt)}</p>
                </>
              )}
            </div>

            {/* Action buttons */}
            {renamingId !== drawing.id && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(drawing); }}
                  className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
                  title="Rename"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                  </svg>
                </button>
                {confirmDeleteId === drawing.id ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(drawing.id); setConfirmDeleteId(null); }}
                    className="p-1 text-red-400 hover:text-red-300 transition-colors text-[11px] font-medium"
                    title="Confirm delete"
                  >
                    Del?
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(drawing.id); }}
                    className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
