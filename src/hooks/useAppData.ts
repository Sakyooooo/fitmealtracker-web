'use client';

import { useState, useEffect, useCallback } from 'react';
import { MealEntry, ExerciseEntry, WeightEntry, AppSettings, GymSession } from '@/lib/types';
import {
  loadMeals, saveMeals,
  loadExercises, saveExercises,
  loadWeights, saveWeights,
  loadSettings, saveSettings,
  loadGymSession, saveGymSession, clearGymSession,
} from '@/lib/storage';
import { generateId, todayString } from '@/lib/stats';

export function useAppData() {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [gymSession, setGymSession] = useState<GymSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMeals(loadMeals());
    setExercises(loadExercises());
    setWeights(loadWeights());
    setSettings(loadSettings());
    setGymSession(loadGymSession());
    setHydrated(true);
  }, []);

  // ── Meals ──────────────────────────────────────────────────────────────
  const addMeal = useCallback((data: Omit<MealEntry, 'id' | 'date'> & { date?: string }) => {
    const entry: MealEntry = { ...data, id: generateId(), date: data.date ?? todayString() };
    setMeals((prev) => {
      const next = [entry, ...prev];
      saveMeals(next);
      return next;
    });
  }, []);

  const updateMeal = useCallback((updated: MealEntry) => {
    setMeals((prev) => {
      const next = prev.map((m) => (m.id === updated.id ? updated : m));
      saveMeals(next);
      return next;
    });
  }, []);

  const deleteMeal = useCallback((id: string) => {
    setMeals((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveMeals(next);
      return next;
    });
  }, []);

  // ── Exercises ──────────────────────────────────────────────────────────
  const addExercise = useCallback((data: Omit<ExerciseEntry, 'id' | 'date'> & { date?: string }) => {
    const entry: ExerciseEntry = { ...data, id: generateId(), date: data.date ?? todayString() };
    setExercises((prev) => {
      const next = [entry, ...prev];
      saveExercises(next);
      return next;
    });
  }, []);

  const updateExercise = useCallback((updated: ExerciseEntry) => {
    setExercises((prev) => {
      const next = prev.map((e) => (e.id === updated.id ? updated : e));
      saveExercises(next);
      return next;
    });
  }, []);

  const deleteExercise = useCallback((id: string) => {
    setExercises((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveExercises(next);
      return next;
    });
  }, []);

  // ── Weights ────────────────────────────────────────────────────────────
  const addWeight = useCallback((data: Omit<WeightEntry, 'id'>) => {
    const entry: WeightEntry = { ...data, id: generateId() };
    setWeights((prev) => {
      const next = [entry, ...prev];
      saveWeights(next);
      return next;
    });
  }, []);

  const deleteWeight = useCallback((id: string) => {
    setWeights((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveWeights(next);
      return next;
    });
  }, []);

  // ── Settings ───────────────────────────────────────────────────────────
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // ── Gym Session ────────────────────────────────────────────────────────
  const startGym = useCallback(() => {
    const session: GymSession = {
      id: generateId(),
      startedAt: new Date().toISOString(),
      status: 'active',
    };
    saveGymSession(session);
    setGymSession(session);
  }, []);

  const endGym = useCallback(() => {
    setGymSession((prev) => {
      if (!prev || prev.status !== 'active') return prev;
      const endedAt = new Date().toISOString();
      const durationSec = Math.floor(
        (new Date(endedAt).getTime() - new Date(prev.startedAt).getTime()) / 1000
      );
      const next: GymSession = { ...prev, endedAt, durationSec, status: 'completed' };
      saveGymSession(next);
      return next;
    });
  }, []);

  const cancelGym = useCallback(() => {
    clearGymSession();
    setGymSession(null);
  }, []);

  const updateGymMemo = useCallback((memo: string) => {
    setGymSession((prev) => {
      if (!prev) return prev;
      const next: GymSession = { ...prev, memo };
      saveGymSession(next);
      return next;
    });
  }, []);

  const saveGymAsExercise = useCallback((calories: number) => {
    setGymSession((prev) => {
      if (!prev || prev.status !== 'completed') return prev;
      const durationMin = Math.round((prev.durationSec ?? 0) / 60);
      const entry: ExerciseEntry = {
        id: generateId(),
        name: 'ジムセッション',
        durationMinutes: durationMin > 0 ? durationMin : 1,
        caloriesBurned: calories,
        date: prev.startedAt.slice(0, 10),
        note: prev.memo ?? '',
        type: 'gymSession',
      };
      setExercises((exPrev) => {
        const next = [entry, ...exPrev];
        saveExercises(next);
        return next;
      });
      clearGymSession();
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
