import { useState, useEffect } from 'react';
import { voiceApi } from '../../lib/chatApi';

export default function VoiceSettingsPanel({ settings, onUpdate, onClose }) {
  const [ttsAvailable, setTtsAvailable] = useState(null);

  useEffect(() => {
    voiceApi.checkStatus()
      .then((res) => setTtsAvailable(res.available))
      .catch(() => setTtsAvailable(false));
  }, []);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200">Voice Settings</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* TTS status */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`w-2 h-2 rounded-full ${ttsAvailable === null ? 'bg-gray-500' : ttsAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-gray-400">
          {ttsAvailable === null ? 'Checking TTS...' : ttsAvailable ? 'TTS server available' : 'TTS server unavailable'}
        </span>
      </div>

      {/* TTS enabled */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-gray-300">Text-to-Speech</span>
        <input
          type="checkbox"
          checked={settings.ttsEnabled}
          onChange={(e) => onUpdate({ ttsEnabled: e.target.checked })}
          className="w-4 h-4 accent-blue-600"
        />
      </label>

      {/* Auto-listen */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-gray-300">Auto-listen after response</span>
        <input
          type="checkbox"
          checked={settings.autoListen}
          onChange={(e) => onUpdate({ autoListen: e.target.checked })}
          className="w-4 h-4 accent-blue-600"
        />
      </label>

      {/* Voice name */}
      <div>
        <label className="block text-sm text-gray-300 mb-1">Voice</label>
        <input
          type="text"
          value={settings.voiceName}
          onChange={(e) => onUpdate({ voiceName: e.target.value })}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
          placeholder="default"
        />
      </div>

      {/* Speech rate */}
      <div>
        <label className="block text-sm text-gray-300 mb-1">
          Speed: {settings.speechRate.toFixed(1)}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={settings.speechRate}
          onChange={(e) => onUpdate({ speechRate: parseFloat(e.target.value) })}
          className="w-full accent-blue-600"
        />
      </div>
    </div>
  );
}
