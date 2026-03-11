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

export const authApi = {
  register: (email, password, name) =>
    fetchJSON('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),

  login: (email, password) =>
    fetchJSON('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  refresh: (refreshToken) =>
    fetchJSON('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  logout: (refreshToken) =>
    fetchJSON('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  getMe: (accessToken) =>
    fetchJSON('/api/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } }),

  updateMe: (data, accessToken) =>
    fetchJSON('/api/auth/me', { method: 'PUT', body: JSON.stringify(data), headers: { Authorization: `Bearer ${accessToken}` } }),

  changePassword: (data, accessToken) =>
    fetchJSON('/api/auth/me/password', { method: 'PUT', body: JSON.stringify(data), headers: { Authorization: `Bearer ${accessToken}` } }),
};
