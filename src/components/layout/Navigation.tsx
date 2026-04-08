'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const TABS = [
  { href: '/meal',     label: '食事',       icon: '🍽️'  },
  { href: '/exercise', label: '運動',       icon: '🏃'  },
  { href: '/weight',   label: '体重',       icon: '⚖️'  },
  { href: '/calendar', label: 'カレンダー', icon: '📅'  },
  { href: '/data',     label: 'データ',     icon: '📊'  },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then((res) => {
      setEmail(res.data.user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-40">
        <div className="flex max-w-2xl mx-auto">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center py-1.5 gap-0.5 text-xs font-medium transition-colors ${
                  active ? 'text-[#4CAF50]' : 'text-gray-400'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop side nav */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-200 flex-col pt-8 z-40">
        <div className="px-6 mb-8">
          <span className="text-xl font-bold text-[#4CAF50]">FitMeal</span>
          <span className="text-xl font-bold text-gray-700">Tracker</span>
        </div>

        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#E8F5E9] text-[#4CAF50] border-r-2 border-[#4CAF50]'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}

        {/* User info + logout (desktop only) */}
        <div className="mt-auto px-4 pb-6 border-t border-gray-100 pt-4">
          {email && (
            <p className="text-xs text-gray-400 truncate mb-2 px-2" title={email}>
              {email}
            </p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 text-sm text-gray-500 border border-gray-200 rounded-xl
                       hover:bg-gray-50 transition-colors font-medium"
          >
            ログアウト
          </button>
        </div>
      </nav>
    </>
  );
}
