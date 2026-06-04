'use client';

import { useState, useEffect, useCallback } from 'react';
import { MealEntry, ExerciseEntry, WeightEntry, AppSettings, GymSession } from '@/lib/types';
import {
  fetchMeals,
  insertMeal,
  updateMeal as updateStoredMeal,
  deleteMeal as deleteStoredMeal,
  fetchExercises,
  insertExercise,
  updateExercise as updateStoredExercise,
  deleteExercise as deleteStoredExercise,
  fetchWeights,
  insertWeight,
  deleteWeight as deleteStoredWeight,
  fetchActiveGymSession,
  insertGymSession,
  updateGymSession,
  deleteGymSession,
  loadSettings,
  saveSettings,
} from '@/lib/localRepository';
import { todayString } from '@/lib/stats';

type NewMealData = Omit<MealEntry, 'id' | 'date' | 'photoUri' | 'photoId'> & {
  date?: string;
  photoFile?: File | null;
};

export function useAppData() {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [gymSession, setGymSession] = useState<GymSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const loadAll = useCallback(async () => {
    setHydrated(false);
    const [m, e, w, gs] = await Promise.all([
      fetchMeals(),
      fetchExercises(),
      fetchWeights(),
      fetchActiveGymSession(),
    ]);
    setMeals(m);
    setExercises(e);
    setWeights(w);
    setGymSession(gs);
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addMeal = useCallback(async (data: NewMealData) => {
    try {
      const saved = await insertMeal({ ...data, date: data.date ?? todayString() });
      setMeals((prev) => [saved, ...prev]);
    } catch (error) {
      console.error('[local] insert meal failed', error);
      alert('食事の保存に失敗しました。もう一度お試しください。');
    }
  }, []);

  const updateMeal = useCallback(async (updated: MealEntry) => {
    try {
      const saved = await updateStoredMeal(updated);
      setMeals((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
    } catch (error) {
      console.error('[local] update meal failed', error);
      alert('食事の更新に失敗しました。');
    }
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    await deleteStoredMeal(id);
  }, []);

  const addExercise = useCallback(async (
    data: Omit<ExerciseEntry, 'id' | 'date'> & { date?: string },
  ) => {
    try {
      const saved = await insertExercise({ ...data, date: data.date ?? todayString() });
      setExercises((prev) => [saved, ...prev]);
    } catch (error) {
      console.error('[local] insert exercise failed', error);
      alert('運動の保存に失敗しました。もう一度お試しください。');
    }
  }, []);

  const updateExercise = useCallback(async (updated: ExerciseEntry) => {
    try {
      const saved = await updateStoredExercise(updated);
      setExercises((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
    } catch (error) {
      console.error('[local] update exercise failed', error);
      alert('運動の更新に失敗しました。');
    }
  }, []);

  const deleteExercise = useCallback(async (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    await deleteStoredExercise(id);
  }, []);

  const addWeight = useCallback(async (data: Omit<WeightEntry, 'id'>) => {
    try {
      const saved = await insertWeight(data);
      setWeights((prev) => [saved, ...prev]);
    } catch (error) {
      console.error('[local] insert weight failed', error);
      alert('体重の保存に失敗しました。もう一度お試しください。');
    }
  }, []);

  const deleteWeight = useCallback(async (id: string) => {
    setWeights((prev) => prev.filter((w) => w.id !== id));
    await deleteStoredWeight(id);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const startGym = useCallback(async () => {
    try {
      const saved = await insertGymSession(new Date().toISOString());
      setGymSession(saved);
    } catch (error) {
      console.error('[local] start gym failed', error);
      alert('ジムセッションの開始に失敗しました。');
    }
  }, []);

  const endGym = useCallback(() => {
    setGymSession((prev) => {
      if (!prev || prev.status !== 'active') return prev;
      const endedAt = new Date().toISOString();
      const durationSec = Math.floor(
        (new Date(endedAt).getTime() - new Date(prev.startedAt).getTime()) / 1000,
      );
      const next: GymSession = { ...prev, endedAt, durationSec, status: 'completed' };
      updateGymSession(next).catch((e) => console.error('endGym sync failed', e));
      return next;
    });
  }, []);

  const cancelGym = useCallback(() => {
    setGymSession((prev) => {
      if (prev) deleteGymSession(prev.id).catch(console.error);
      return null;
    });
  }, []);

  const updateGymMemo = useCallback((memo: string) => {
    setGymSession((prev) => {
      if (!prev) return prev;
      const next: GymSession = { ...prev, memo };
      updateGymSession(next).catch((e) => console.error('memo sync failed', e));
      return next;
    });
  }, []);

  const saveGymAsExercise = useCallback((calories: number) => {
    setGymSession((prev) => {
      if (!prev || prev.status !== 'completed') return prev;
      const durationMin = Math.round((prev.durationSec ?? 0) / 60);
      const exerciseData: Omit<ExerciseEntry, 'id'> = {
        name: 'ジムセッション',
        durationMinutes: durationMin > 0 ? durationMin : 1,
        caloriesBurned: calories,
        date: prev.startedAt.slice(0, 10),
        note: prev.memo ?? '',
        type: 'gymSession',
      };
      insertExercise(exerciseData)
        .then((saved) => setExercises((ex) => [saved, ...ex]))
        .catch(console.error);
      deleteGymSession(prev.id).catch(console.error);
      return null;
    });
  }, []);

  return {
    meals, exercises, weights, settings, gymSession, hydrated,
    addMeal, updateMeal, deleteMeal,
    addExercise, updateExercise, deleteExercise,
    addWeight, deleteWeight,
    updateSettings,
    startGym, endGym, cancelGym, updateGymMemo, saveGymAsExercise,
  };
}
