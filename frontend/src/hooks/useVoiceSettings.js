import { useState, useCallback } from 'react';

const STORAGE_KEY = 'clawmander-voice-settings';

const DEFAULTS = {
  ttsEnabled: false,
  voiceName: 'default',
  speechRate: 1.0,
  autoListen: false,
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function useVoiceSettings() {
  const [settings, setSettings] = useState(load);

  const updateSettings = useCallback((partial) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
