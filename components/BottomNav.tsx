'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartNoAxesColumn, House, ReceiptText, Settings2 } from 'lucide-react';

const TABS = [
  { href: '/', label: 'Home', icon: House },
  { href: '/history', label: 'History', icon: ReceiptText },
  { href: '/insights', label: 'Insights', icon: ChartNoAxesColumn },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-16 grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[12px] font-medium transition-colors ${
                  active ? 'text-ink' : 'text-muted hover:text-ink2'
                }`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                    active ? 'bg-accent text-accent-ink' : ''
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

