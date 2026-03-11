import { useState, useCallback } from 'react';

const STORAGE_KEY = 'clawmander-service-settings';

const DEFAULTS = {
  chatterboxUrl: 'http://localhost:8400',
  excalidrawAssetPath: '',
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function useServiceSettings() {
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
