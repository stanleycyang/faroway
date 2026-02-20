'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TOOL_LINKS = [
  { label: 'All Tools', href: '/tools' },
  { label: 'Quiz', href: '/tools/travel-quiz' },
  { label: 'Packing', href: '/tools/packing-list' },
  { label: 'Cost', href: '/tools/trip-cost' },
  { label: 'Best Time', href: '/tools/best-time-to-visit' },
  { label: 'Visa', href: '/tools/visa-checker' },
  { label: 'Currency', href: '/tools/currency-converter' },
];

export function ToolsNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-16 lg:top-20 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
          {TOOL_LINKS.map((link) => {
            const isActive =
              link.href === '/tools'
                ? pathname === '/tools'
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
