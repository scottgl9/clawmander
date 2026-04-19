import { useMemo, useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { API_URL } from '../lib/constants';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchMessages() {
  const res = await fetch(`${API_URL}/api/sms/messages?limit=200`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function getMmsStatus(msg) {
  if (msg.type !== 'mms') return null;
  if (msg.downloaded_at || msg.body_downloaded || msg.parts) {
    return { label: 'downloaded', className: 'bg-green-500/20 text-green-300' };
  }
  return { label: 'metadata only', className: 'bg-yellow-500/20 text-yellow-300' };
}

export default function SmsPage() {
  const connected = useSSE(() => {});
  const { data, loading, error, reload } = useAPI(fetchMessages);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const messages = Array.isArray(data) ? data : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((msg) => {
      if (typeFilter !== 'all' && msg.type !== typeFilter) return false;
      if (!q) return true;
      return [msg.sender, msg.recipient, msg.body, msg.subject, msg.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [messages, query, typeFilter]);

  return (
    <Layout connected={connected}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">SMS / MMS</h2>
            <p className="text-sm text-gray-500">Messages received through the gateway backend that powers Clawmander.</p>
          </div>
          <button
            onClick={reload}
            className="px-4 py-2 rounded-lg bg-surface-light text-sm text-gray-200 hover:text-white hover:bg-surface-lighter transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="bg-surface rounded-lg p-4 border border-gray-800 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Total fetched</div>
            <div className="text-2xl font-bold text-white">{messages.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">SMS</div>
            <div className="text-2xl font-bold text-white">{messages.filter((m) => m.type === 'sms').length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">MMS</div>
            <div className="text-2xl font-bold text-white">{messages.filter((m) => m.type === 'mms').length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Visible</div>
            <div className="text-2xl font-bold text-white">{filtered.length}</div>
          </div>
        </div>

        <div className="bg-surface rounded-lg p-4 border border-gray-800 mb-6 flex flex-col md:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sender, recipient, body, subject, or id"
            className="flex-1 rounded-lg bg-surface-light border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-accent"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg bg-surface-light border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="all">All types</option>
            <option value="sms">SMS only</option>
            <option value="mms">MMS only</option>
          </select>
        </div>

        {loading && <p className="text-gray-500">Loading messages...</p>}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="space-y-3">
          {filtered.map((msg) => {
            const mmsStatus = getMmsStatus(msg);
            const displayBody = msg.body_downloaded || msg.body;
            return (
            <div key={`${msg.type}-${msg.id}-${msg.received_at}`} className="bg-surface rounded-lg border border-gray-800 p-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${msg.type === 'mms' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                      {msg.type}
                    </span>
                    <span className="text-xs text-gray-500">ID {msg.id}</span>
                    {mmsStatus && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${mmsStatus.className}`}>
                        {mmsStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white"><span className="text-gray-500">From:</span> {msg.sender || '—'}</div>
                  <div className="text-sm text-white"><span className="text-gray-500">To:</span> {msg.recipient || '—'}</div>
                </div>
                <div className="text-xs text-gray-500 lg:text-right">
                  <div>Received: {formatDate(msg.received_at)}</div>
                  <div>Stored: {formatDate(msg.stored_at)}</div>
                  {msg.type === 'mms' && (
                    <div>Downloaded: {formatDate(msg.downloaded_at)}</div>
                  )}
                </div>
              </div>

              {msg.subject && (
                <div className="mb-2 text-sm text-gray-300">
                  <span className="text-gray-500">Subject:</span> {msg.subject}
                </div>
              )}

              <div className="text-sm text-gray-200 whitespace-pre-wrap break-words bg-surface-light rounded-lg p-3 border border-gray-800">
                {displayBody || (msg.type === 'mms'
                  ? <span className="text-yellow-300 italic">Metadata received, but no downloaded MMS body has been stored yet.</span>
                  : <span className="text-gray-500 italic">No body available</span>)}
              </div>
            </div>
          )})}

          {!loading && !error && filtered.length === 0 && (
            <div className="bg-surface rounded-lg border border-gray-800 p-6 text-center text-gray-500">
              No messages match the current filters.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
