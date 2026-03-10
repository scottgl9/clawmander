import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout({ children, connected, noPadding = false }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col">
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
