'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string; icon: ReactNode; match?: string[] };

const TABS: Tab[] = [
  {
    href: '/meal',
    label: '食事',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/>
        <path d="M7 2v20"/>
        <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
      </svg>
    ),
  },
  {
    href: '/exercise',
    label: '運動',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    href: '/friends',
    label: '友達',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'マイページ',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 md:hidden z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex max-w-2xl mx-auto">
          {TABS.map((tab) => {
            const active = (tab.match ?? [tab.href]).some((p) => pathname.startsWith(p));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
                  active ? 'text-gray-900' : 'text-gray-300'
                }`}
              >
                {tab.icon}
                <span className={`text-[10px] font-bold tracking-wide ${active ? 'text-gray-900' : 'text-gray-300'}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop side nav */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-52 bg-[#0A0A0A] flex-col pt-10 z-40">
        <div className="px-6 mb-10">
          <p className="text-white font-black text-lg tracking-tight">FitMeal</p>
          <p className="text-white/30 text-xs font-medium tracking-widest uppercase">Tracker</p>
        </div>

        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3 px-6 py-3.5 text-sm font-bold transition-colors ${
                active ? 'text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              {tab.icon}
              <span className="tracking-wide">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
