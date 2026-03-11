import { useState, useRef, useCallback } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

// Swipe detection thresholds
const SWIPE_MIN_X = 40;   // minimum horizontal distance (px) to count as a swipe
const SWIPE_MAX_Y = 80;   // maximum vertical drift allowed before cancelling
const EDGE_ZONE = 64;     // px from left edge that triggers open swipe (right swipe)

export default function Layout({ children, connected, noPadding = false }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const touchStart = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = Math.abs(t.clientY - touchStart.current.y);
    touchStart.current = null;

    // Ignore if too much vertical drift (user scrolling)
    if (dy > SWIPE_MAX_Y) return;

    // Swipe right → open nav (only from left edge zone so it doesn't conflict with chat gestures)
    if (dx > SWIPE_MIN_X && !mobileMenuOpen) {
      const startX = e.changedTouches[0].clientX - dx; // reconstruct start X
      if (startX <= EDGE_ZONE) {
        setMobileMenuOpen(true);
      }
    }

    // Swipe left → close nav
    if (dx < -SWIPE_MIN_X && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [mobileMenuOpen]);

  return (
    <div
      className="h-screen flex flex-col" style={{ height: '100dvh' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Header connected={connected} onMenuToggle={() => setMobileMenuOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <main className={`flex-1 overflow-hidden ${noPadding ? 'flex flex-col' : 'overflow-y-auto p-3 md:p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
