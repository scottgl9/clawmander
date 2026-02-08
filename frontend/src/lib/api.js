import { API_URL } from './constants';

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
    getMonthly: () => fetchJSON('/api/views/monthly'),
  },
  server: {
    getStatus: () => fetchJSON('/api/server/status'),
  },
  activity: {
    getLog: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return fetchJSON(`/api/activity/log${qs ? '?' + qs : ''}`);
    },
  },
};
