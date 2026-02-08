import { useState, useEffect } from 'react';

export default function Header({ connected }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-surface border-b border-gray-800">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white tracking-wide">Clawmander</h1>
        <span className="text-xs text-gray-500">Command Center</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500 pulse-glow'}`} />
          <span className="text-xs text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <span className="text-sm text-gray-400 font-mono">
          {time.toLocaleTimeString()}
        </span>
      </div>
    </header>
  );
}
