export default function ControlBadge({ mode, onToggle }) {
  const config = {
    agent: {
      label: 'Agent',
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      dot: 'bg-blue-400',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
        </svg>
      ),
    },
    user: {
      label: 'User',
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      dot: 'bg-green-400',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
        </svg>
      ),
    },
    shared: {
      label: 'Shared',
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      dot: 'bg-yellow-400',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
  };

  const c = config[mode] || config.shared;

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${c.bg} ${c.text} hover:opacity-80 transition-opacity ${mode === 'agent' ? 'animate-pulse' : ''}`}
      title={`Control: ${c.label}. Click to toggle.`}
    >
      {c.icon}
      {c.label}
    </button>
  );
}
