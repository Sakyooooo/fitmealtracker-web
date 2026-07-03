'use client';

import { useAppDataContext } from '@/store/AppDataProvider';

/** 食事データへのアクセス。実体は AppDataProvider の単一ストア。 */
export function useMealData() {
  const { meals, hydrated, addMeal, updateMeal, deleteMeal } = useAppDataContext();
  return { meals, hydrated, addMeal, updateMeal, deleteMeal };
}
