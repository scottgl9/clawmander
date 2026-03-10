export default function SubagentBadge({ activity }) {
  if (!activity || activity.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {activity.map((s) => (
        <div
          key={s.childSessionKey}
          className="flex items-center gap-1.5 px-2 py-0.5 bg-purple-900/40 border border-purple-700/50 rounded-full text-xs text-purple-300"
        >
          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
          <span>{s.label || s.childSessionKey}</span>
          {s.state && <span className="text-purple-500">· {s.state}</span>}
        </div>
      ))}
    </div>
  );
}
