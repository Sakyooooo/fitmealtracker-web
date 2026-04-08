'use client';

import { useState, useEffect, useCallback } from 'react';
import { MealEntry, ExerciseEntry, WeightEntry, AppSettings, GymSession } from '@/lib/types';
import {
  dbFetchMeals, dbInsertMeal, dbUpdateMeal, dbDeleteMeal,
  dbFetchExercises, dbInsertExercise, dbUpdateExercise, dbDeleteExercise,
  dbFetchWeights, dbInsertWeight, dbDeleteWeight,
  dbFetchActiveGymSession, dbInsertGymSession, dbUpdateGymSession, dbDeleteGymSession,
} from '@/lib/db';
import { loadSettings, saveSettings } from '@/lib/storage';
import { todayString } from '@/lib/stats';

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
      dbFetchMeals(),
      dbFetchExercises(),
      dbFetchWeights(),
      dbFetchActiveGymSession(),
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

  // ── Meals ──────────────────────────────────────────────────────────────────
  const addMeal = useCallback(async (
    data: Omit<MealEntry, 'id' | 'date'> & { date?: string },
  ) => {
    const saved = await dbInsertMeal({ ...data, date: data.date ?? todayString() });
    if (saved) setMeals((prev) => [saved, ...prev]);
    else alert('食事の保存に失敗しました。もう一度お試しください。');
  }, []);

  const updateMeal = useCallback(async (updated: MealEntry) => {
    const saved = await dbUpdateMeal(updated);
    if (saved) setMeals((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
    else alert('食事の更新に失敗しました。');
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    await dbDeleteMeal(id);
  }, []);

  // ── Exercises ──────────────────────────────────────────────────────────────
  const addExercise = useCallback(async (
    data: Omit<ExerciseEntry, 'id' | 'date'> & { date?: string },
  ) => {
    const saved = await dbInsertExercise({ ...data, date: data.date ?? todayString() });
    if (saved) setExercises((prev) => [saved, ...prev]);
    else alert('運動の保存に失敗しました。もう一度お試しください。');
  }, []);

  const updateExercise = useCallback(async (updated: ExerciseEntry) => {
    const saved = await dbUpdateExercise(updated);
    if (saved) setExercises((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
    else alert('運動の更新に失敗しました。');
  }, []);

  const deleteExercise = useCallback(async (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    await dbDeleteExercise(id);
  }, []);

  // ── Weights ────────────────────────────────────────────────────────────────
  const addWeight = useCallback(async (data: Omit<WeightEntry, 'id'>) => {
    const saved = await dbInsertWeight(data);
    if (saved) setWeights((prev) => [saved, ...prev]);
    else alert('体重の保存に失敗しました。もう一度お試しください。');
  }, []);

  const deleteWeight = useCallback(async (id: string) => {
    setWeights((prev) => prev.filter((w) => w.id !== id));
    await dbDeleteWeight(id);
  }, []);

  // ── Settings (localStorage のみ) ───────────────────────────────────────────
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // ── Gym Session ────────────────────────────────────────────────────────────
  const startGym = useCallback(async () => {
    const saved = await dbInsertGymSession(new Date().toISOString());
    if (saved) setGymSession(saved);
    else alert('ジムセッションの開始に失敗しました。');
  }, []);

  const endGym = useCallback(() => {
    setGymSession((prev) => {
      if (!prev || prev.status !== 'active') return prev;
      const endedAt = new Date().toISOString();
      const durationSec = Math.floor(
        (new Date(endedAt).getTime() - new Date(prev.startedAt).getTime()) / 1000,
      );
      const next: GymSession = { ...prev, endedAt, durationSec, status: 'completed' };
      dbUpdateGymSession(next).catch((e) => console.error('endGym sync failed', e));
      return next;
    });
  }, []);

  const cancelGym = useCallback(() => {
    setGymSession((prev) => {
      if (prev) dbDeleteGymSession(prev.id).catch(console.error);
      return null;
    });
  }, []);

  const updateGymMemo = useCallback((memo: string) => {
    setGymSession((prev) => {
      if (!prev) return prev;
      const next: GymSession = { ...prev, memo };
      dbUpdateGymSession(next).catch((e) => console.error('memo sync failed', e));
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
      dbInsertExercise(exerciseData)
        .then((saved) => {
          if (saved) setExercises((ex) => [saved, ...ex]);
        })
        .catch(console.error);
      dbDeleteGymSession(prev.id).catch(console.error);
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
