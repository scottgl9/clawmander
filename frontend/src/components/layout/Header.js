import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';

export default function Header({ connected, onMenuToggle }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [time, setTime] = useState(null);
  const [heartbeatData, setHeartbeatData] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fetch heartbeat status from API
  useEffect(() => {
    const fetchHeartbeat = async () => {
      try {
        const res = await fetch('/api/agents/heartbeat');
        const data = await res.json();
        if (data && data.length > 0) {
          setHeartbeatData(data[0]);
          setLastFetchTime(Date.now());
          setCountdown(data[0].secondsUntilNext);
        }
      } catch (err) {
        console.error('Failed to fetch heartbeat:', err);
      }
    };

    fetchHeartbeat();
    const interval = setInterval(fetchHeartbeat, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update clock and countdown every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now);
      if (heartbeatData && lastFetchTime) {
        const elapsedSinceLastFetch = Math.floor((Date.now() - lastFetchTime) / 1000);
        const calculatedCountdown = heartbeatData.secondsUntilNext - elapsedSinceLastFetch;
        setCountdown(calculatedCountdown > 0 ? calculatedCountdown : 0);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [heartbeatData, lastFetchTime]);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const formatCountdown = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCountdownColor = () => {
    if (!countdown) return 'text-gray-400';
    if (countdown < 60) return 'text-red-400';
    if (countdown < 120) return 'text-yellow-400';
    return 'text-green-400';
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push('/login');
  };

  const userInitial = user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : '?';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3 md:px-6 py-3 bg-surface border-b border-gray-800 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-1 text-gray-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white tracking-wide">Clawmander</h1>
        <span className="hidden sm:inline text-xs text-gray-500">Command Center</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500 pulse-glow'}`} />
          <span className="hidden sm:inline text-xs text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        {countdown !== null && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-surface-light rounded border border-gray-700">
            <span className="text-xs text-gray-500">Next heartbeat:</span>
            <span className={`text-sm font-mono font-semibold ${getCountdownColor()}`}>
              {formatCountdown(countdown)}
            </span>
          </div>
        )}
        <span className="text-sm text-gray-400 font-mono" suppressHydrationWarning>
          {time ? time.toLocaleTimeString() : '--:--:--'}
        </span>

        {/* User menu */}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-indigo-700 hover:bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold transition-colors"
              aria-label="User menu"
            >
              {userInitial}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-800">
                  <p className="text-sm font-medium text-white truncate">{user.name || 'User'}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); router.push('/settings'); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
