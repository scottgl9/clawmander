import { PRIORITY_COLORS, STATUS_COLORS } from '../../lib/constants';

export function PriorityBadge({ priority }) {
  const color = PRIORITY_COLORS[priority] || '#6b7280';
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
      style={{ backgroundColor: color + '20', color }}
    >
      {priority}
    </span>
  );
}

export function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#6b7280';
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
      style={{ backgroundColor: color + '20', color }}
    >
      {status?.replace('_', ' ')}
    </span>
  );
}
