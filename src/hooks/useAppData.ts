'use client';

import { useAppDataContext } from '@/store/AppDataProvider';

/**
 * アプリ全データ（食事/運動/体重/設定/ジム）へのアクセス。
 * 実体は AppDataProvider の単一ストア（画面間で状態を共有する）。
 */
export function useAppData() {
  return useAppDataContext();
}
