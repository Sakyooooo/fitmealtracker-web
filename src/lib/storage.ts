'use client';

import { MealEntry, ExerciseEntry, WeightEntry, AppSettings, GymSession } from './types';

const KEYS = {
  meals: 'fmt_meals',
  exercises: 'fmt_exercises',
  weights: 'fmt_weights',
  settings: 'fmt_settings',
} as const;

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.error('[storage] save failed', key);
  }
}

export function loadMeals(): MealEntry[] {
  return load<MealEntry[]>(KEYS.meals, []);
}
export function saveMeals(meals: MealEntry[]): void {
  save(KEYS.meals, meals);
}

export function loadExercises(): ExerciseEntry[] {
  return load<ExerciseEntry[]>(KEYS.exercises, []);
}
export function saveExercises(exercises: ExerciseEntry[]): void {
  save(KEYS.exercises, exercises);
}

export function loadWeights(): WeightEntry[] {
  return load<WeightEntry[]>(KEYS.weights, []);
}
export function saveWeights(weights: WeightEntry[]): void {
  save(KEYS.weights, weights);
}

export function loadSettings(): AppSettings {
  return load<AppSettings>(KEYS.settings, {});
}
export function saveSettings(settings: AppSettings): void {
  save(KEYS.settings, settings);
}

const GYM_SESSION_KEY = 'fmt_gym_session';

export function loadGymSession(): GymSession | null {
  return load<GymSession | null>(GYM_SESSION_KEY, null);
}
export function saveGymSession(session: GymSession): void {
  save(GYM_SESSION_KEY, session);
}
export function clearGymSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GYM_SESSION_KEY);
}
