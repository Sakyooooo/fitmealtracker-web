'use client';

import { useAppDataContext } from '@/store/AppDataProvider';

/** アプリ設定へのアクセス。実体は AppDataProvider の単一ストア。 */
export function useSettings() {
  const { settings, updateSettings } = useAppDataContext();
  return { settings, updateSettings };
}
