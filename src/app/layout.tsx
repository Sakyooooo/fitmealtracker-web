import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from '@/components/layout/ClientLayout';

// Supabase クライアントを使うページはビルド時に静的生成できないため動的レンダリングに固定
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'FitMealTracker',
  description: '食事・運動管理アプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-[#F5F5F5]">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
