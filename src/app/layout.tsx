import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/layout/Navigation';

export const metadata: Metadata = {
  title: 'FitMealTracker',
  description: '食事・運動管理アプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-[#F5F5F5]">
        <div className="max-w-2xl mx-auto pb-20 md:pb-0 md:ml-56">
          {children}
        </div>
        <Navigation />
      </body>
    </html>
  );
}
