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

export const approvalsApi = {
  getAll: () => fetchJSON('/api/approvals'),
  updateDefaults: (defaults) => fetchJSON('/api/approvals/defaults', { method: 'PUT', body: JSON.stringify(defaults) }),
  updateAgent: (id, data) => fetchJSON(`/api/approvals/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addAllowlistEntry: (agentId, entry) => fetchJSON(`/api/approvals/agents/${agentId}/allowlist`, { method: 'POST', body: JSON.stringify(entry) }),
  deleteAllowlistEntry: (agentId, entryId) => fetchJSON(`/api/approvals/agents/${agentId}/allowlist/${entryId}`, { method: 'DELETE' }),
  addTool: (agentId, tool) => fetchJSON(`/api/approvals/agents/${agentId}/tools`, { method: 'POST', body: JSON.stringify({ tool }) }),
  deleteTool: (agentId, tool) => fetchJSON(`/api/approvals/agents/${agentId}/tools/${encodeURIComponent(tool)}`, { method: 'DELETE' }),
};
