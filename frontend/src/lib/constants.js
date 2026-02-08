export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const STATUS_COLORS = {
  queued: '#6366f1',
  in_progress: '#3b82f6',
  done: '#22c55e',
  blocked: '#ef4444',
};

export const AGENT_STATUS_COLORS = {
  active: '#22c55e',
  idle: '#6b7280',
  offline: '#1f2937',
  error: '#ef4444',
};

export const PRIORITY_COLORS = {
  low: '#6b7280',
  medium: '#3b82f6',
  high: '#f59e0b',
  critical: '#ef4444',
};

export const KANBAN_COLUMNS = [
  { key: 'queued', label: 'Queued' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
];
