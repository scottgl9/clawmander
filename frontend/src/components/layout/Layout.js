import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout({ children, connected }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      <Header connected={connected} onMenuToggle={() => setMobileMenuOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
