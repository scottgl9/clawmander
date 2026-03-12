import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/layout/Layout';
import { useSSE } from '../hooks/useSSE';
import { API_URL } from '../lib/constants';

const BrowserPanel = dynamic(() => import('../components/browser/BrowserPanel'), { ssr: false });

export default function BrowserPage() {
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);

  const fetchInstances = useCallback(async () => {
    try {
      const token = localStorage.getItem('clawmander-token');
      const res = await fetch(`${API_URL}/api/browser`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setInstances(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  // Auto-create and select "default" instance on first visit
  useEffect(() => {
    if (instances.length === 0 && !loading && !selected) {
      createInstance('default');
    } else if (instances.length > 0 && !selected) {
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
      const token = localStorage.getItem('clawmander-token');
      const res = await fetch(`${API_URL}/api/browser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: id || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelected(data.id);
        // SSE will add to instances list
      }
    } catch {}
    setLoading(false);
  };

  const destroyInstance = async (id) => {
    try {
      const token = localStorage.getItem('clawmander-token');
      await fetch(`${API_URL}/api/browser/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // SSE will remove from list
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
