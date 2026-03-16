import { useState, useCallback, useRef, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { useSSE } from '../../hooks/useSSE';
import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import DrawingSidebar from './DrawingSidebar';

const ExcalidrawWrapper = dynamic(() => import('./ExcalidrawWrapper'), { ssr: false });

// Memoised canvas section — only re-renders when activeDrawingId or activeDrawing change,
// not on sidebar refreshes or saving-state toggles.
const CanvasSection = memo(function CanvasSection({ activeDrawingId, activeDrawing, onChange, excalidrawAPIRef }) {
  if (!activeDrawing) return null;
  return (
    <ExcalidrawWrapper
      key={activeDrawingId}
      initialData={activeDrawing.data}
      onChange={onChange}
      excalidrawAPIRef={excalidrawAPIRef}
    />
  );
});

export default function DrawPage({ onConnectionChange }) {
  const [activeDrawingId, setActiveDrawingId] = useState(null);
  const [activeDrawing, setActiveDrawing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const excalidrawAPIRef = useRef(null);

  const connected = useSSE(useCallback((event) => {
    if (event.type.startsWith('drawing.')) {
      // Ignore SSE events triggered by our own auto-save to avoid
      // re-fetching the sidebar list while actively editing.
      if (savingRef.current) return;
      setRefreshKey((k) => k + 1);
    }
  }, []));

  useEffect(() => { onConnectionChange?.(connected); }, [connected, onConnectionChange]);

  const { data: drawings, loading: listLoading } = useAPI(() => api.drawings.getAll(), [refreshKey]);

  // Load full drawing only when selection changes (not on refreshKey — that's for the sidebar list).
  // Re-fetching the active drawing on every SSE event causes Excalidraw UI to jerk.
  useEffect(() => {
    if (!activeDrawingId) {
      setActiveDrawing(null);
      return;
    }
    let cancelled = false;
    api.drawings.getById(activeDrawingId).then((d) => {
      if (!cancelled) setActiveDrawing(d);
    }).catch(() => {
      if (!cancelled) setActiveDrawing(null);
    });
    return () => { cancelled = true; };
  }, [activeDrawingId]);

  const handleChange = useCallback((elements, appState, files) => {
    if (!activeDrawingId) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      savingRef.current = true;
      try {
        // Only send serializable appState keys
        const { collaborators, ...cleanState } = appState;
        await api.drawings.update(activeDrawingId, {
          data: { elements, appState: cleanState, files },
        });
      } catch {} finally {
        // Brief grace period so the SSE echo from our own save is suppressed
        setTimeout(() => { savingRef.current = false; }, 500);
        setSaving(false);
      }
    }, 1000);
  }, [activeDrawingId]);

  const handleCreate = useCallback(async () => {
    try {
      const drawing = await api.drawings.create({ title: `Drawing ${(drawings?.length || 0) + 1}` });
      setActiveDrawingId(drawing.id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('[Draw] Failed to create drawing:', err.message);
    }
  }, [drawings]);

  const handleDelete = useCallback(async (id) => {
    await api.drawings.delete(id);
    if (activeDrawingId === id) {
      setActiveDrawingId(null);
      setActiveDrawing(null);
    }
    setRefreshKey((k) => k + 1);
  }, [activeDrawingId]);

  const handleRename = useCallback(async (id, title) => {
    await api.drawings.update(id, { title });
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex w-full md:w-auto flex-shrink-0`}>
        <DrawingSidebar
          drawings={drawings || []}
          loading={listLoading}
          activeId={activeDrawingId}
          onSelect={(id) => { setActiveDrawingId(id); setMobileSidebarOpen(false); }}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onRename={handleRename}
        />
      </div>

      {/* Main content */}
      <div className={`${!mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 overflow-hidden`}>
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-surface">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="text-gray-400 hover:text-white p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="text-sm text-gray-300 truncate">
            {activeDrawing?.title || 'Select a drawing'}
          </span>
          {saving && <span className="text-xs text-gray-500 ml-auto">Saving...</span>}
        </div>

        {/* Editor or empty state */}
        {activeDrawing ? (
          <div className="flex-1 relative">
            {saving && (
              <div className="absolute top-2 right-2 z-10 text-xs text-gray-500 bg-surface/80 px-2 py-1 rounded hidden md:block pointer-events-none">
                Saving...
              </div>
            )}
            <CanvasSection
              activeDrawingId={activeDrawingId}
              activeDrawing={activeDrawing}
              onChange={handleChange}
              excalidrawAPIRef={excalidrawAPIRef}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="mx-auto text-gray-700 mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
              </svg>
              <p className="text-gray-500 text-sm mb-3">Select a drawing or create a new one</p>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/80 transition-colors"
              >
                New Drawing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
