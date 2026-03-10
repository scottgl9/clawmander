const COMMANDS = [
  { cmd: '/model', args: '', desc: 'Switch model (shows picker)' },
  { cmd: '/reset', args: '', desc: 'Reset session (new context)' },
  { cmd: '/new', args: '', desc: 'New session' },
  { cmd: '/abort', args: '', desc: 'Abort active run' },
  { cmd: '/approve', args: '', desc: 'Approve pending command' },
  { cmd: '/deny', args: '', desc: 'Deny pending command' },
  { cmd: '/think', args: '<level>', desc: 'Set thinking level' },
  { cmd: '/verbose', args: '<on|off>', desc: 'Toggle verbose mode' },
  { cmd: '/elevated', args: '<on|off|ask|full>', desc: 'Set elevated permissions' },
  { cmd: '/agent', args: '<id>', desc: 'Switch to agent session' },
  { cmd: '/session', args: '<key>', desc: 'Switch to session by key' },
  { cmd: '/help', args: '', desc: 'Show this help' },
];

export default function SlashCommandMenu({ input, onSelect, onAction, visible, models = [] }) {
  if (!visible || !input.startsWith('/')) return null;

  const lower = input.toLowerCase().trimEnd();

  // "/model" exactly OR "/model <filter>" → show model picker
  if (lower === '/model' || lower.startsWith('/model ')) {
    const query = lower === '/model' ? '' : input.slice(7).toLowerCase();
    const filtered = models.filter(
      (m) => !query || m.id?.toLowerCase().includes(query) || m.name?.toLowerCase().includes(query) || m.provider?.toLowerCase().includes(query)
    );
    if (filtered.length === 0 && query) return null;

    // Group by provider
    const byProvider = {};
    for (const m of filtered) {
      const p = m.provider || 'other';
      if (!byProvider[p]) byProvider[p] = [];
      byProvider[p].push(m);
    }

    return (
      <div className="absolute bottom-full mb-1 left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden max-h-72 overflow-y-auto">
        {Object.entries(byProvider).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider bg-gray-850 border-b border-gray-700 sticky top-0">
              {provider}
            </div>
            {providerModels.map((m) => (
              <button
                key={m.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  // Directly switch model — no need to type and press enter
                  if (onAction) onAction('switchModel', m.id);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-700 transition-colors text-left"
              >
                <span className="text-white text-xs">{m.id}</span>
                {m.name && m.name !== m.id && (
                  <span className="text-gray-500 text-[11px] ml-3 truncate max-w-[180px]">{m.name}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Default: filter commands by prefix
  const matches = COMMANDS.filter((c) => c.cmd.startsWith(lower));
  if (matches.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-1 left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
      {matches.map((c) => (
        <button
          key={c.cmd}
          onMouseDown={(e) => { e.preventDefault(); onSelect(c.cmd + (c.args ? ' ' : '')); }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-700 transition-colors text-left"
        >
          <span className="text-blue-400 font-mono font-semibold min-w-[100px]">{c.cmd}</span>
          {c.args && <span className="text-gray-500 font-mono text-xs">{c.args}</span>}
          <span className="text-gray-400 text-xs ml-auto">{c.desc}</span>
        </button>
      ))}
    </div>
  );
}
