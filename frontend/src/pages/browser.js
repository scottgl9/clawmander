import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/layout/Layout';
import { useSSE } from '../hooks/useSSE';
import { API_URL } from '../lib/constants';

const BrowserPanel = dynamic(() => import('../components/browser/BrowserPanel'), { ssr: false });

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function BrowserPage() {
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);
  const autoCreatedRef = useRef(false);

  const fetchInstances = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/browser`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        setInstances(data);
        return data;
      }
    } catch {}
    return null;
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  // Auto-create "default" instance on first visit (only once)
  useEffect(() => {
    if (autoCreatedRef.current || loading) return;
    if (instances.length === 0) {
      autoCreatedRef.current = true;
      createInstance('default');
    } else if (!selected) {
      setSelected(instances[0].id);
    }
  }, [instances, loading, selected]);

  const handleSSE = useCallback((event) => {
    if (event.type === 'browser.created') {
      setInstances((prev) => {
        if (prev.find((i) => i.id === event.data.id)) return prev;
        return [...prev, event.data];
      });
    } else if (event.type === 'browser.destroyed') {
      setInstances((prev) => prev.filter((i) => i.id !== event.data.id));
      setSelected((prev) => (prev === event.data.id ? null : prev));
    } else if (event.type === 'sse.reconnected') {
      fetchInstances();
    }
  }, [fetchInstances]);

  useSSE(handleSSE);

  const createInstance = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/browser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ id: id || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        // Add to instances immediately (don't rely solely on SSE)
        setInstances((prev) => {
          if (prev.find((i) => i.id === data.id)) return prev;
          return [...prev, data];
        });
        setSelected(data.id);
      } else if (res.status === 409) {
        // Already exists — just select it
        setSelected(id);
      }
    } catch {}
    setLoading(false);
  };

  const destroyInstance = async (id) => {
    try {
      await fetch(`${API_URL}/api/browser/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      // Update locally immediately
      setInstances((prev) => prev.filter((i) => i.id !== id));
      setSelected((prev) => (prev === id ? null : prev));
    } catch {}
  };

  return (
    <Layout connected={connected} noPadding>
      <div className="flex flex-col h-full">
        {/* Instance tabs */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-800 bg-surface-light overflow-x-auto">
          {instances.map((inst) => (
            <button
              key={inst.id}
              onClick={() => setSelected(inst.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors whitespace-nowrap ${
                selected === inst.id
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-white hover:bg-surface-lighter'
              }`}
            >
              <span>{inst.id}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  destroyInstance(inst.id);
                }}
                className="ml-1 text-gray-500 hover:text-red-400 cursor-pointer"
                title="Close"
              >
                ×
              </span>
            </button>
          ))}
          <button
            onClick={() => createInstance()}
            disabled={loading}
            className="px-2 py-1.5 text-sm text-gray-500 hover:text-white hover:bg-surface-lighter rounded transition-colors"
            title="New Browser"
          >
            +
          </button>
        </div>

        {/* Browser panel */}
        <div className="flex-1 min-h-0">
          {selected ? (
            <BrowserPanel instanceId={selected} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {loading ? 'Starting browser...' : 'No browser instance selected'}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
