import Link from 'next/link';
import { useRouter } from 'next/router';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '~' },
  { href: '/daily', label: 'Daily', icon: 'D' },
  { href: '/weekly', label: 'Weekly', icon: 'W' },
  { href: '/monthly', label: 'Monthly', icon: 'M' },
  { href: '/budget', label: 'Budget', icon: '$' },
  { href: '/activity', label: 'Activity', icon: 'A' },
];

export default function Sidebar() {
  const router = useRouter();

  return (
    <aside className="w-16 bg-surface-light border-r border-gray-800 flex flex-col items-center py-4 gap-2">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = router.pathname === href;
        return (
          <Link key={href} href={href}>
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer transition-colors ${
                active
                  ? 'bg-accent text-white'
                  : 'text-gray-500 hover:text-white hover:bg-surface-lighter'
              }`}
              title={label}
            >
              {icon}
            </div>
          </Link>
        );
      })}
    </aside>
  );
}
