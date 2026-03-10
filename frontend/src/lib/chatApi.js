import { API_URL } from './constants';

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try { const body = await res.json(); msg = body.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const chatApi = {
  getSessions: () => fetchJSON('/api/chat/sessions'),
  getModels: () => fetchJSON('/api/chat/models'),
  getHistory: (sessionKey) => fetchJSON(`/api/chat/history/${encodeURIComponent(sessionKey)}`),

  send: (sessionKey, message, attachments = []) =>
    fetchJSON('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify({ sessionKey, message, attachments }),
    }),

  abort: (sessionKey, runId) =>
    fetchJSON('/api/chat/abort', {
      method: 'POST',
      body: JSON.stringify({ sessionKey, runId }),
    }),

  resetSession: (sessionKey, reason = 'new') =>
    fetchJSON(`/api/chat/sessions/${encodeURIComponent(sessionKey)}/reset`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  patchSession: (sessionKey, patches) =>
    fetchJSON(`/api/chat/sessions/${encodeURIComponent(sessionKey)}/patch`, {
      method: 'POST',
      body: JSON.stringify(patches),
    }),

  resolveApproval: (approvalId, decision) =>
    fetchJSON('/api/chat/approval/resolve', {
      method: 'POST',
      body: JSON.stringify({ approvalId, decision }),
    }),

  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/chat/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
};
