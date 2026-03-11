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
