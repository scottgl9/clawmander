import { API_URL } from './constants';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function tryRefreshToken() {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const { accessToken } = await res.json();
    localStorage.setItem('accessToken', accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const retryRes = await fetch(`${API_URL}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
        ...options,
      });
      if (!retryRes.ok) {
        let msg = `API error: ${retryRes.status}`;
        try { const body = await retryRes.json(); msg = body.error || msg; } catch {}
        throw new Error(msg);
      }
      return retryRes.json();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }

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
      headers: getAuthHeaders(),
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
