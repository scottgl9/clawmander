import { useState, useEffect } from 'react';
import { approvalsApi } from '../../lib/approvalsApi';

const SECURITY_LEVELS = [
  { value: 'full', label: 'Full', desc: 'Agent can run any command without approval' },
  { value: 'allowlist', label: 'Allowlist', desc: 'Only pre-approved commands are allowed' },
  { value: 'deny', label: 'Deny', desc: 'All exec commands are blocked' },
];

const ASK_OPTIONS = [
  { value: 'on-miss', label: 'On Miss', desc: 'Prompt when command not in allowlist' },
  { value: 'always', label: 'Always', desc: 'Prompt for every command' },
  { value: 'never', label: 'Never', desc: 'Never prompt (deny or allow based on allowlist)' },
];

const SECURITY_COLORS = {
  full: 'text-green-400 bg-green-950/40',
  allowlist: 'text-indigo-400 bg-indigo-950/40',
  deny: 'text-red-400 bg-red-950/40',
};

function SecurityBadge({ level }) {
  const cls = SECURITY_COLORS[level] || 'text-gray-400 bg-gray-800';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${cls}`}>
      {level}
    </span>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500 transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label} — {opt.desc}</option>
        ))}
      </select>
    </div>
  );
}

function ToolsSection({ agent, onAdd, onDelete }) {
  const [toolName, setToolName] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!toolName.trim()) return;
    onAdd(agent.id, toolName.trim());
    setToolName('');
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-700">
      <h5 className="text-xs font-semibold text-gray-400 mb-2">Approved Tools</h5>
      {agent.tools && agent.tools.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {agent.tools.map((tool) => (
            <span key={tool} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 font-mono">
              {tool}
              <button
                onClick={() => onDelete(agent.id, tool)}
                className="text-gray-500 hover:text-red-400 transition-colors leading-none"
                title="Remove"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-2">No tools approved for this agent.</p>
      )}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={toolName}
          onChange={(e) => setToolName(e.target.value)}
          placeholder="e.g. read, exec, web_search"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-gray-500 transition-colors"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Add
        </button>
      </form>
    </div>
  );
}

function AllowlistSection({ agent, onAdd, onDelete }) {
  const [pattern, setPattern] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!pattern.trim()) return;
    onAdd(agent.id, { pattern: pattern.trim() });
    setPattern('');
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-700">
      <h5 className="text-xs font-semibold text-gray-400 mb-2">Allowlist</h5>
      {agent.allowlist && agent.allowlist.length > 0 ? (
        <table className="w-full text-xs mb-2">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-1 pr-2 text-gray-500">Pattern</th>
              <th className="text-left py-1 pr-2 text-gray-500">Last Used</th>
              <th className="py-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {agent.allowlist.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-800">
                <td className="py-1 pr-2 font-mono text-gray-200">{entry.pattern}</td>
                <td className="py-1 pr-2 text-gray-500">
                  {entry.lastUsedAt ? new Date(entry.lastUsedAt).toLocaleDateString() : '--'}
                </td>
                <td className="py-1">
                  <button
                    onClick={() => onDelete(agent.id, entry.id)}
                    className="text-red-500 hover:text-red-300 transition-colors"
                    title="Delete"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-gray-500 mb-2">No allowlist entries for this agent.</p>
      )}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="e.g. /usr/bin/npm, ~/bin/*, npm run *"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-gray-500 transition-colors"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Add
        </button>
      </form>
    </div>
  );
}

export default function ExecApprovals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [defaults, setDefaults] = useState({ security: 'allowlist', ask: 'on-miss' });
  const [msg, setMsg] = useState(null);
  const [agentEdits, setAgentEdits] = useState({});
  const [expandedAgents, setExpandedAgents] = useState({});
  const [expandedTools, setExpandedTools] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await approvalsApi.getAll();
      setData(result);
      setDefaults(result.defaults || { security: 'allowlist', ask: 'on-miss' });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefaults = async () => {
    setMsg(null);
    try {
      await approvalsApi.updateDefaults(defaults);
      setMsg({ ok: true, text: 'Default exec settings saved. Restart gateway to apply.' });
      await loadData();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const handleSaveAgent = async (agentId) => {
    setMsg(null);
    try {
      const edit = agentEdits[agentId];
      if (!edit) return;
      await approvalsApi.updateAgent(agentId, edit);
      setMsg({ ok: true, text: `${agentId} exec settings saved. Restart gateway to apply.` });
      await loadData();
      setAgentEdits((prev) => { const next = { ...prev }; delete next[agentId]; return next; });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const handleAddAllowlistEntry = async (agentId, entry) => {
    setMsg(null);
    try {
      await approvalsApi.addAllowlistEntry(agentId, entry);
      setMsg({ ok: true, text: 'Allowlist entry added.' });
      await loadData();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const handleDeleteAllowlistEntry = async (agentId, entryId) => {
    setMsg(null);
    try {
      await approvalsApi.deleteAllowlistEntry(agentId, entryId);
      await loadData();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const toggleExpanded = (agentId) => {
    setExpandedAgents((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const toggleToolsExpanded = (agentId) => {
    setExpandedTools((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const handleAddTool = async (agentId, tool) => {
    setMsg(null);
    try {
      await approvalsApi.addTool(agentId, tool);
      await loadData();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const handleDeleteTool = async (agentId, tool) => {
    setMsg(null);
    try {
      await approvalsApi.deleteTool(agentId, tool);
      await loadData();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg p-3 text-sm text-red-400 bg-red-950/30 border border-red-900/50">
          {error}
        </div>
      )}

      {msg && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${msg.ok ? 'text-green-400 bg-green-950/30 border-green-900/50' : 'text-red-400 bg-red-950/30 border-red-900/50'}`}>
          {msg.text}
        </p>
      )}

      {/* Defaults Section */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Global Exec Settings</h3>
        <p className="text-xs text-gray-500 mb-4">Default security policy for all agents unless overridden below.</p>
        <div className="space-y-3">
          <SelectField
            label="Security Level"
            value={defaults.security}
            onChange={(v) => setDefaults({ ...defaults, security: v })}
            options={SECURITY_LEVELS}
          />
          <SelectField
            label="Ask Behavior"
            value={defaults.ask || 'on-miss'}
            onChange={(v) => setDefaults({ ...defaults, ask: v })}
            options={ASK_OPTIONS}
          />
          <button
            onClick={handleSaveDefaults}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Save Defaults
          </button>
        </div>
      </div>

      {/* Per-Agent Section */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Per-Agent Overrides</h3>
        {(data?.agents || []).map((agent) => {
          const editSecurity = agentEdits[agent.id]?.security || agent.security;
          const isExpanded = expandedAgents[agent.id];
          const hasEdit = !!agentEdits[agent.id];
          const isToolsExpanded = expandedTools[agent.id];
          return (
            <div key={agent.id} className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white">{agent.name}</h4>
                <SecurityBadge level={editSecurity} />
              </div>

              <div className="space-y-3">
                <SelectField
                  label="Security Level"
                  value={editSecurity}
                  onChange={(v) => setAgentEdits((prev) => ({ ...prev, [agent.id]: { security: v } }))}
                  options={SECURITY_LEVELS}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSaveAgent(agent.id)}
                    disabled={!hasEdit}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => toggleToolsExpanded(agent.id)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {isToolsExpanded ? 'Hide Tools' : 'Show Tools'}
                  </button>
                  <button
                    onClick={() => toggleExpanded(agent.id)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {isExpanded ? 'Hide Allowlist' : 'Show Allowlist'}
                  </button>
                </div>
              </div>

              {isToolsExpanded && (
                <ToolsSection
                  agent={agent}
                  onAdd={handleAddTool}
                  onDelete={handleDeleteTool}
                />
              )}

              {isExpanded && (
                <AllowlistSection
                  agent={agent}
                  onAdd={handleAddAllowlistEntry}
                  onDelete={handleDeleteAllowlistEntry}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Wildcard allowlist */}
      {data?.wildcardAllowlist && data.wildcardAllowlist.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Global Allowlist</h3>
          <p className="text-xs text-gray-500 mb-3">Patterns allowed for all agents.</p>
          <AllowlistSection
            agent={{ id: '*', allowlist: data.wildcardAllowlist }}
            onAdd={handleAddAllowlistEntry}
            onDelete={handleDeleteAllowlistEntry}
          />
        </div>
      )}
    </div>
  );
}
