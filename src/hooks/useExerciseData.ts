'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExerciseEntry } from '@/lib/types';
import {
  fetchExercises,
  insertExercise,
  updateExercise as updateStoredExercise,
  deleteExercise as deleteStoredExercise,
} from '@/lib/localRepository';
import { sbUpsertExercise, sbDeleteExercise } from '@/lib/supabaseRepository';
import { todayString } from '@/lib/stats';

export function useExerciseData() {
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    fetchExercises().then((e) => { setExercises(e); setHydrated(true); });
  }, []);

  const addExercise = useCallback(async (
    data: Omit<ExerciseEntry, 'id' | 'date'> & { date?: string },
  ) => {
    try {
      const saved = await insertExercise({ ...data, date: data.date ?? todayString() });
      setExercises((prev) => [saved, ...prev]);
      sbUpsertExercise(saved).catch(console.error);
    } catch (error) {
      console.error('[useExerciseData] addExercise', error);
      alert(error instanceof Error ? error.message : '運動の保存に失敗しました。');
    }
  }, []);

  const updateExercise = useCallback(async (updated: ExerciseEntry) => {
    try {
      const saved = await updateStoredExercise(updated);
      setExercises((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      sbUpsertExercise(saved).catch(console.error);
    } catch (error) {
      console.error('[useExerciseData] updateExercise', error);
      alert('運動の更新に失敗しました。');
    }
  }, []);

  const deleteExercise = useCallback(async (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    await deleteStoredExercise(id);
    sbDeleteExercise(id).catch(console.error);
  }, []);

  const prependExercise = useCallback((exercise: ExerciseEntry) => {
    setExercises((prev) => [exercise, ...prev]);
    sbUpsertExercise(exercise).catch(console.error);
  }, []);

  return { exercises, hydrated, addExercise, updateExercise, deleteExercise, prependExercise };
}
