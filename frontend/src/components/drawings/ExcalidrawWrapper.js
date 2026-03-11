import { useEffect, useRef, useCallback } from 'react';
import '@excalidraw/excalidraw/index.css';
import { Excalidraw } from '@excalidraw/excalidraw';

// Apply stored asset path before Excalidraw initializes
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('clawmander-service-settings');
    if (stored) {
      const { excalidrawAssetPath } = JSON.parse(stored);
      if (excalidrawAssetPath) window.EXCALIDRAW_ASSET_PATH = excalidrawAssetPath;
    }
  } catch {}
}

export default function ExcalidrawWrapper({ initialData, onChange, excalidrawAPIRef }) {
  const apiRef = useRef(null);
  const initializedRef = useRef(false);

  const handleChange = useCallback((elements, appState, files) => {
    // Skip the initial mount change
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    onChange?.(elements, appState, files);
  }, [onChange]);

  useEffect(() => {
    if (excalidrawAPIRef) {
      excalidrawAPIRef.current = apiRef.current;
    }
  }, [excalidrawAPIRef]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; }}
        initialData={initialData || undefined}
        onChange={handleChange}
        theme="dark"
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: { saveFileToDisk: true },
          },
        }}
      />
    </div>
  );
}
