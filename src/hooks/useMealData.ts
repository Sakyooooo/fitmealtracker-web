'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MealEntry } from '@/lib/types';
import {
  fetchMeals,
  insertMeal,
  updateMeal as updateStoredMeal,
  deleteMeal as deleteStoredMeal,
} from '@/lib/localRepository';
import { sbUpsertMeal, sbDeleteMeal, sbUploadMealPhoto } from '@/lib/supabaseRepository';
import { todayString } from '@/lib/stats';

type NewMealData = Omit<MealEntry, 'id' | 'date' | 'photoUri' | 'photoId'> & {
  date?: string;
  photoFile?: File | null;
};

export function useMealData() {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const photoUrlsRef = useRef<string[]>([]);

  function revokePhotoUrls() {
    photoUrlsRef.current.forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } });
    photoUrlsRef.current = [];
  }

  async function load() {
    revokePhotoUrls();
    const m = await fetchMeals();
    photoUrlsRef.current = m.flatMap((meal) => (meal.photoUri ? [meal.photoUri] : []));
    setMeals(m);
    setHydrated(true);
  }

  useEffect(() => {
    load();
    return () => { revokePhotoUrls(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMeal = useCallback(async (data: NewMealData) => {
    try {
      const saved = await insertMeal({ ...data, date: data.date ?? todayString() });
      if (saved.photoUri) photoUrlsRef.current.push(saved.photoUri);
      setMeals((prev) => [saved, ...prev]);
      // Supabase に非同期で同期（写真があれば Storage にアップロードして photo_url を付与）
      (async () => {
        let photoUrl: string | undefined;
        if (data.photoFile) {
          photoUrl = (await sbUploadMealPhoto(saved.id, data.photoFile)) ?? undefined;
        }
        await sbUpsertMeal({ ...saved, photoUrl });
      })().catch(console.error);
    } catch (error) {
      console.error('[useMealData] addMeal', error);
      alert(error instanceof Error ? error.message : '食事の保存に失敗しました。');
    }
  }, []);

  const updateMeal = useCallback(async (updated: MealEntry) => {
    try {
      const saved = await updateStoredMeal(updated);
      setMeals((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      sbUpsertMeal(saved).catch(console.error);
    } catch (error) {
      console.error('[useMealData] updateMeal', error);
      alert('食事の更新に失敗しました。');
    }
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    await deleteStoredMeal(id);
    sbDeleteMeal(id).catch(console.error);
  }, []);

  return { meals, hydrated, addMeal, updateMeal, deleteMeal };
}
