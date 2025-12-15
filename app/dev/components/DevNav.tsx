// Navigation component for dev pages

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dev/listings', label: 'Listings' },
  { href: '/dev/analysis', label: 'Analysis' },
  { href: '/dev/capture', label: 'Capture' },
  { href: '/dev/seed', label: 'Seed' },
  { href: '/dev/aggregate', label: 'Aggregate' },
];

export default function DevNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 border-b pb-4">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold text-gray-500 mr-4">Dev Tools:</h2>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

