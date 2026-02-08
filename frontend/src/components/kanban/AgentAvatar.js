import { AGENT_STATUS_COLORS } from '../../lib/constants';

export default function AgentAvatar({ name, status }) {
  const color = AGENT_STATUS_COLORS[status] || '#6b7280';
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="relative">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{ backgroundColor: color + '40', border: `2px solid ${color}` }}
        title={`${name} (${status})`}
      >
        {initial}
      </div>
      <div
        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}
