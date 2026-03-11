import { API_URL } from './constants';

const AUTH_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
      ...options.headers,
    },
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
    const res = await fetch(`${API_URL}/api/chat/upload`, {
      method: 'POST',
      body: formData,
      headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {},
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
};

export const voiceApi = {
  speak: async (text, voice = 'default', signal, chatterboxUrl) => {
    const res = await fetch(`${API_URL}/api/voice/tts`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, ...(chatterboxUrl ? { chatterboxUrl } : {}) }),
    });
    if (!res.ok) throw new Error(`TTS error: ${res.status}`);
    return res.blob();
  },
  checkStatus: () => fetchJSON('/api/voice/tts/status'),
};
