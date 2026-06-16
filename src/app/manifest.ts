import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FitMealTracker',
    short_name: 'FitMeal',
    description: '食事・運動・体重を記録するパーソナルトラッカー',
    start_url: '/meal',
    display: 'standalone',
    background_color: '#F5F5F5',
    theme_color: '#ffffff',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
