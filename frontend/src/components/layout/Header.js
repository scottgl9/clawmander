import { useState, useEffect } from 'react';

export default function Header({ connected }) {
  const [time, setTime] = useState(null);
  const [heartbeatData, setHeartbeatData] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  // Fetch heartbeat status from API
  useEffect(() => {
    const fetchHeartbeat = async () => {
      try {
        const res = await fetch('/api/agents/heartbeat');
        const data = await res.json();
        if (data && data.length > 0) {
          setHeartbeatData(data[0]);
          setLastFetchTime(Date.now());
          // Initialize countdown from API's secondsUntilNext
          setCountdown(data[0].secondsUntilNext);
        }
      } catch (err) {
        console.error('Failed to fetch heartbeat:', err);
      }
    };

    fetchHeartbeat();
    const interval = setInterval(fetchHeartbeat, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Update clock and countdown every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now);

      // Calculate countdown based on elapsed time since last fetch
      if (heartbeatData && lastFetchTime) {
        const elapsedSinceLastFetch = Math.floor((Date.now() - lastFetchTime) / 1000);
        const calculatedCountdown = heartbeatData.secondsUntilNext - elapsedSinceLastFetch;
        
        // If countdown goes negative, it means we're past the expected heartbeat time
        // Keep it at 0 until the next API refresh updates with the new nextHeartbeat
        setCountdown(calculatedCountdown > 0 ? calculatedCountdown : 0);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [heartbeatData, lastFetchTime]);

  const formatCountdown = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCountdownColor = () => {
    if (!countdown) return 'text-gray-400';
    if (countdown < 60) return 'text-red-400'; // Less than 1 minute
    if (countdown < 120) return 'text-yellow-400'; // Less than 2 minutes
    return 'text-green-400'; // Good
  };

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
        {countdown !== null && (
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-light rounded border border-gray-700">
            <span className="text-xs text-gray-500">Next heartbeat:</span>
            <span className={`text-sm font-mono font-semibold ${getCountdownColor()}`}>
              {formatCountdown(countdown)}
            </span>
          </div>
        )}
        <span className="text-sm text-gray-400 font-mono" suppressHydrationWarning>
          {time ? time.toLocaleTimeString() : '--:--:--'}
        </span>
      </div>
    </header>
  );
}
