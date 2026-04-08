'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname.startsWith('/auth');

  if (isAuth) {
    // Auth page: full viewport, no nav, no wrapper
    return <>{children}</>;
  }

  return (
    <>
      <div className="max-w-2xl mx-auto pb-20 md:pb-0 md:ml-56">
        {children}
      </div>
      <Navigation />
    </>
  );
}
