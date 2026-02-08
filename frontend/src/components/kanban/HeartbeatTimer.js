import { useState, useEffect } from 'react';

export default function HeartbeatTimer({ nextHeartbeat, heartbeatInterval }) {
  const [seconds, setSeconds] = useState(null);

  useEffect(() => {
    function calc() {
      if (!nextHeartbeat) return setSeconds(null);
      const diff = Math.round((new Date(nextHeartbeat).getTime() - Date.now()) / 1000);
      setSeconds(diff);
    }
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [nextHeartbeat]);

  if (seconds === null) return <span className="text-[10px] text-gray-600">--:--</span>;

  const abs = Math.abs(seconds);
  const min = Math.floor(abs / 60);
  const sec = abs % 60;
  const display = `${seconds < 0 ? '-' : ''}${min}:${sec.toString().padStart(2, '0')}`;

  let colorClass = 'text-green-400';
  if (seconds < 0) colorClass = 'text-red-400 pulse-glow';
  else if (seconds < 30) colorClass = 'text-red-400';
  else if (seconds < 120) colorClass = 'text-yellow-400';

  return (
    <span className={`text-[10px] font-mono ${colorClass}`} title="Next heartbeat">
      {display}
    </span>
  );
}
