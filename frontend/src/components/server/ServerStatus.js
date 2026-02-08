function formatDuration(ms) {
  if (!ms && ms !== 0) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatRelative(iso) {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function StatusItem({ label, value, className = '' }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-sm ${className || 'text-gray-300'}`}>{value ?? 'N/A'}</span>
    </div>
  );
}

export default function ServerStatus({ status }) {
  if (!status) return <p className="text-gray-600">No server status available</p>;

  const isConnected = status.connection === 'connected';
  const heartbeatConfig = status.statusSummary?.heartbeat;
  const sessions = status.statusSummary?.sessions;
  const channelSummary = status.statusSummary?.channelSummary;

  return (
    <div className="space-y-4">
      {/* Connection */}
      <div className="bg-surface rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-white mb-3">Connection</h3>
        <div className="space-y-1">
          <div className="flex justify-between py-1">
            <span className="text-gray-500 text-sm">Status</span>
            <span className={`text-sm font-medium flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {status.connection}
            </span>
          </div>
          <StatusItem label="OpenClaw URL" value={status.openClawUrl} />
          <StatusItem label="Server Version" value={status.serverVersion} />
          <StatusItem label="Server Host" value={status.serverHost} />
          <StatusItem label="Connected Since" value={status.connectedAt ? formatRelative(status.connectedAt) : 'N/A'} />
          <StatusItem label="Gateway Uptime" value={formatDuration(status.uptimeMs)} />
        </div>
      </div>

      {/* Heartbeat Config */}
      <div className="bg-surface rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-white mb-3">Heartbeat Config</h3>
        {heartbeatConfig ? (
          <div className="space-y-1">
            <StatusItem label="Default Agent" value={status.sessionDefaults?.defaultAgentId} />
            {heartbeatConfig.agents && Object.entries(heartbeatConfig.agents).map(([agentId, cfg]) => (
              <div key={agentId} className="flex justify-between py-1">
                <span className="text-gray-500 text-sm">{agentId}</span>
                <span className="text-sm text-gray-300">
                  {cfg.enabled !== false ? `${cfg.interval || '?'}s` : 'disabled'}
                </span>
              </div>
            ))}
            {!heartbeatConfig.agents && <p className="text-xs text-gray-600">No agent config available</p>}
          </div>
        ) : (
          <p className="text-xs text-gray-600">No heartbeat data available</p>
        )}
      </div>

      {/* Connected Instances */}
      <div className="bg-surface rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-white mb-3">
          Connected Instances
          {status.presence?.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500">({status.presence.length})</span>
          )}
        </h3>
        {status.presence?.length > 0 ? (
          <div className="space-y-2">
            {status.presence.map((inst, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded bg-surface-light">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-300 truncate">{inst.host || inst.clientId || 'unknown'}</div>
                  <div className="text-xs text-gray-500">
                    {[inst.platform, inst.version, inst.mode].filter(Boolean).join(' / ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600">No instances connected</p>
        )}
      </div>

      {/* Sessions */}
      <div className="bg-surface rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-white mb-3">Sessions</h3>
        {sessions ? (
          <div className="space-y-1">
            <StatusItem label="Total Sessions" value={sessions.total ?? sessions.count} />
            <StatusItem label="Default Model" value={sessions.defaultModel} />
            <StatusItem label="Channels" value={channelSummary?.count ?? channelSummary?.total} />
          </div>
        ) : (
          <p className="text-xs text-gray-600">No session data available</p>
        )}
      </div>

      {/* Last Updated */}
      {status.lastUpdated && (
        <p className="text-xs text-gray-600 text-right">Last updated: {formatRelative(status.lastUpdated)}</p>
      )}
    </div>
  );
}
