import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientLayout from '@/components/layout/ClientLayout';

export const metadata: Metadata = {
  title: 'FitMealTracker',
  description: '食事・運動・体重を記録するパーソナルトラッカー',
  applicationName: 'FitMeal',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FitMeal',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon', // app/apple-icon.tsx が生成する 180×180 PNG（iOS ホーム画面用）
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  viewportFit: 'cover', // ノッチ/ホームインジケータ領域まで描画（safe-area で内側に余白）
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
