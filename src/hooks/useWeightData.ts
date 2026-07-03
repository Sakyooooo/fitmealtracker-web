'use client';

import { useAppDataContext } from '@/store/AppDataProvider';

/** 体重データへのアクセス。実体は AppDataProvider の単一ストア。 */
export function useWeightData() {
  const { weights, hydrated, addWeight, deleteWeight } = useAppDataContext();
  return { weights, hydrated, addWeight, deleteWeight };
}
