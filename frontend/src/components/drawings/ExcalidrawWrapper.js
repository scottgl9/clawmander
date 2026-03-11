import { useEffect, useRef, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';

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
