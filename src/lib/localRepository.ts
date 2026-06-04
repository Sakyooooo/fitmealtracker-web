'use client';

import { deleteImage, getImageObjectUrl, saveImage } from './imageStore';
import {
  AppSettings,
  ExerciseEntry,
  GymSession,
  MealEntry,
  WeightEntry,
} from './types';

const KEYS = {
  meals: 'fmt_meals',
  exercises: 'fmt_exercises',
  weights: 'fmt_weight_records',
  settings: 'fmt_settings',
  gymSessions: 'fmt_gym_sessions',
} as const;

type NewMealEntry = Omit<MealEntry, 'id' | 'photoUri' | 'photoId'> & {
  photoFile?: File | null;
};

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

async function withPhotoUrls(meals: MealEntry[]): Promise<MealEntry[]> {
  return Promise.all(
    meals.map(async (meal) => {
      if (!meal.photoId) return { ...meal, photoUri: undefined };
      const photoUri = await getImageObjectUrl(meal.photoId);
      return { ...meal, photoUri: photoUri ?? undefined };
    }),
  );
}

function storedMeal(meal: MealEntry): MealEntry {
  const rest = { ...meal };
  delete rest.photoUri;
  return rest;
}

export async function fetchMeals(): Promise<MealEntry[]> {
  return withPhotoUrls(load<MealEntry[]>(KEYS.meals, []));
}

export async function insertMeal(entry: NewMealEntry): Promise<MealEntry> {
  const photoId = entry.photoFile ? await saveImage(entry.photoFile) : undefined;
  const mealData = { ...entry };
  delete mealData.photoFile;
  const meal: MealEntry = { ...mealData, id: generateId(), photoId };
  const meals = load<MealEntry[]>(KEYS.meals, []);
  save(KEYS.meals, [storedMeal(meal), ...meals.map(storedMeal)]);
  const [hydrated] = await withPhotoUrls([meal]);
  return hydrated;
}

export async function updateMeal(entry: MealEntry): Promise<MealEntry> {
  const meals = load<MealEntry[]>(KEYS.meals, []);
  save(KEYS.meals, meals.map((meal) => (meal.id === entry.id ? storedMeal(entry) : meal)));
  const [hydrated] = await withPhotoUrls([entry]);
  return hydrated;
}

export async function deleteMeal(id: string): Promise<void> {
  const meals = load<MealEntry[]>(KEYS.meals, []);
  const meal = meals.find((item) => item.id === id);
  save(KEYS.meals, meals.filter((item) => item.id !== id));
  if (meal?.photoId) await deleteImage(meal.photoId);
}

export async function fetchExercises(): Promise<ExerciseEntry[]> {
  return load<ExerciseEntry[]>(KEYS.exercises, []);
}

export async function insertExercise(entry: Omit<ExerciseEntry, 'id'>): Promise<ExerciseEntry> {
  const exercise: ExerciseEntry = { ...entry, id: generateId() };
  save(KEYS.exercises, [exercise, ...load<ExerciseEntry[]>(KEYS.exercises, [])]);
  return exercise;
}

export async function updateExercise(entry: ExerciseEntry): Promise<ExerciseEntry> {
  const exercises = load<ExerciseEntry[]>(KEYS.exercises, []);
  save(KEYS.exercises, exercises.map((item) => (item.id === entry.id ? entry : item)));
  return entry;
}

export async function deleteExercise(id: string): Promise<void> {
  save(
    KEYS.exercises,
    load<ExerciseEntry[]>(KEYS.exercises, []).filter((item) => item.id !== id),
  );
}

export async function fetchWeights(): Promise<WeightEntry[]> {
  return load<WeightEntry[]>(KEYS.weights, []);
}

export async function insertWeight(entry: Omit<WeightEntry, 'id'>): Promise<WeightEntry> {
  const weight: WeightEntry = { ...entry, id: generateId() };
  save(KEYS.weights, [weight, ...load<WeightEntry[]>(KEYS.weights, [])]);
  return weight;
}

export async function deleteWeight(id: string): Promise<void> {
  save(
    KEYS.weights,
    load<WeightEntry[]>(KEYS.weights, []).filter((item) => item.id !== id),
  );
}

export async function fetchActiveGymSession(): Promise<GymSession | null> {
  return load<GymSession[]>(KEYS.gymSessions, []).find((session) => session.status === 'active') ?? null;
}

export async function insertGymSession(startedAt: string): Promise<GymSession> {
  const session: GymSession = { id: generateId(), startedAt, status: 'active' };
  save(KEYS.gymSessions, [session, ...load<GymSession[]>(KEYS.gymSessions, [])]);
  return session;
}

export async function updateGymSession(session: GymSession): Promise<void> {
  const sessions = load<GymSession[]>(KEYS.gymSessions, []);
  save(
    KEYS.gymSessions,
    sessions.map((item) => (item.id === session.id ? session : item)),
  );
}

export async function deleteGymSession(id: string): Promise<void> {
  save(
    KEYS.gymSessions,
    load<GymSession[]>(KEYS.gymSessions, []).filter((item) => item.id !== id),
  );
}

export function loadSettings(): AppSettings {
  return load<AppSettings>(KEYS.settings, {});
}

export function saveSettings(settings: AppSettings): void {
  save(KEYS.settings, settings);
}
