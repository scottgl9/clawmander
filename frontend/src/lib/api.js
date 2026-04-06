import { API_URL } from './constants';

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function getAuthHeaders() {
  const token = getAccessToken();
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
      if (!retryRes.ok) throw new Error(`API error: ${retryRes.status}`);
      return retryRes.json();
    }
    // Refresh failed — redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  agents: {
    getStatus: () => fetchJSON('/api/agents/status'),
    getHeartbeat: () => fetchJSON('/api/agents/heartbeat'),
  },
  tasks: {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return fetchJSON(`/api/tasks${qs ? '?' + qs : ''}`);
    },
    getStats: () => fetchJSON('/api/tasks/stats'),
    getById: (id) => fetchJSON(`/api/tasks/${id}`),
  },
  work: {
    getActionItems: () => fetchJSON('/api/work/action-items'),
    getPersonalItems: () => fetchJSON('/api/work/action-items/personal'),
    getWorkItems: () => fetchJSON('/api/work/action-items/work'),
    getCompletedItems: () => fetchJSON('/api/work/action-items/completed'),
    getBrief: () => fetchJSON('/api/work/brief'),
    getDailyTasks: () => fetchJSON('/api/work/daily-tasks'),
    toggleDailyTask: (id, completed) => fetchJSON(`/api/work/daily-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer changeme' },
      body: JSON.stringify({ completed }),
    }),
  },
  budget: {
    getSummary: () => fetchJSON('/api/budget/summary'),
    getTrends: () => fetchJSON('/api/budget/trends'),
    getUpcomingBills: () => fetchJSON('/api/budget/upcoming-bills'),
  },
  jobs: {
    getRecent: () => fetchJSON('/api/jobs/recent'),
  },
  views: {
    getDaily: () => fetchJSON('/api/views/daily'),
    getWeekly: () => fetchJSON('/api/views/weekly'),
  },
  cron: {
    getJobs: () => fetchJSON('/api/cron/jobs'),
    getJobRuns: (jobId, limit = 20) => fetchJSON(`/api/cron/jobs/${jobId}/runs?limit=${limit}`),
  },
  feeds: {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return fetchJSON(`/api/feeds${qs ? '?' + qs : ''}`);
    },
  },
  memory: {
    getWeeks: (limit = 12) => fetchJSON(`/api/memory/weeks?limit=${limit}`),
    getWeek: (weekId) => fetchJSON(`/api/memory/weeks/${weekId}`),
  },
  server: {
    getStatus: () => fetchJSON('/api/server/status'),
  },
  drawings: {
    getAll: () => fetchJSON('/api/drawings'),
    getById: (id) => fetchJSON(`/api/drawings/${id}`),
    create: (data) => fetchJSON('/api/drawings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchJSON(`/api/drawings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => fetchJSON(`/api/drawings/${id}`, { method: 'DELETE' }),
  },
  activity: {
    getLog: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return fetchJSON(`/api/activity/log${qs ? '?' + qs : ''}`);
    },
  },
};
