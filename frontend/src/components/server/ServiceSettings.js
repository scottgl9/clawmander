import { useState, useEffect } from 'react';
import { useServiceSettings } from '../../hooks/useServiceSettings';
import { voiceApi } from '../../lib/chatApi';

function Field({ label, hint, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-600 mb-1.5">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
      />
    </div>
  );
}

function StatusBadge({ state }) {
  const styles = {
    idle: 'text-gray-500',
    checking: 'text-yellow-400',
    ok: 'text-green-400',
    error: 'text-red-400',
  };
  const labels = {
    idle: '',
    checking: 'Checking...',
    ok: 'Reachable',
    error: 'Unreachable',
  };
  const dots = {
    idle: 'bg-gray-600',
    checking: 'bg-yellow-400 animate-pulse',
    ok: 'bg-green-500',
    error: 'bg-red-500',
  };
  if (state === 'idle') return null;
  return (
    <span className={`flex items-center gap-1.5 text-xs ${styles[state]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[state]}`} />
      {labels[state]}
    </span>
  );
}

export default function ServiceSettings() {
  const { settings, updateSettings } = useServiceSettings();
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [chatterboxStatus, setChatterboxStatus] = useState('idle');

  // Keep draft in sync if settings change externally
  useEffect(() => { setDraft(settings); }, []);

  const checkChatterbox = async () => {
    setChatterboxStatus('checking');
    try {
      const res = await voiceApi.checkStatus();
      setChatterboxStatus(res.available ? 'ok' : 'error');
    } catch {
      setChatterboxStatus('error');
    }
    setTimeout(() => setChatterboxStatus('idle'), 4000);
  };

  const handleSave = () => {
    updateSettings(draft);

    // Apply Excalidraw asset path immediately for this session
    if (typeof window !== 'undefined' && draft.excalidrawAssetPath !== undefined) {
      window.EXCALIDRAW_ASSET_PATH = draft.excalidrawAssetPath || undefined;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800 space-y-5">
      <h3 className="text-sm font-semibold text-white">Service Endpoints</h3>

      {/* Chatterbox */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Chatterbox TTS</span>
          <div className="flex items-center gap-2">
            <StatusBadge state={chatterboxStatus} />
            <button
              onClick={checkChatterbox}
              disabled={chatterboxStatus === 'checking'}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              Test
            </button>
          </div>
        </div>
        <Field
          label="Server URL"
          hint="Base URL of the Chatterbox TTS server (OpenAI-compatible /v1/audio/speech endpoint)"
          value={draft.chatterboxUrl}
          onChange={(v) => setDraft((d) => ({ ...d, chatterboxUrl: v }))}
          placeholder="http://localhost:8400"
        />
      </div>

      <div className="border-t border-gray-800" />

      {/* Excalidraw */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Excalidraw</span>
        <Field
          label="Asset Path"
          hint={`Self-hosted font/asset CDN path. Leave blank to use the default CDN. Sets window.EXCALIDRAW_ASSET_PATH — reload the Draw page after saving.`}
          value={draft.excalidrawAssetPath}
          onChange={(v) => setDraft((d) => ({ ...d, excalidrawAssetPath: v }))}
          placeholder="https://your-cdn.example.com/excalidraw-assets/"
        />
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && <span className="text-xs text-green-400">Saved</span>}
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  );
}
