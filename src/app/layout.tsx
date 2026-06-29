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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Daily Recap で使用（本文: Zen Maru Gothic / 数字: Outfit）。
            App Router の root layout なので全ページ共通で読み込まれる。 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Zen+Maru+Gothic:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F5F5F5]">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
