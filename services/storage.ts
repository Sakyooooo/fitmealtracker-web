import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealEntry, ExerciseEntry, GymSession, ExerciseType, WeightEntry, AppSettings } from '../types';

export const STORAGE_KEYS = {
  MEALS: '@fitmeal/meals',
  EXERCISES: '@fitmeal/exercises',
  ACTIVE_GYM_SESSION: '@fitmeal/activeGymSession',
  IS_INITIALIZED: '@fitmeal/isInitialized',
  WEIGHTS: '@fitmeal/weights',
  SETTINGS: '@fitmeal/settings',
} as const;

// ─── Meals ────────────────────────────────────────────────────────────────────

export async function saveMeals(meals: MealEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(meals));
}

export async function loadMeals(): Promise<MealEntry[] | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
  if (!raw) return null;
  return JSON.parse(raw) as MealEntry[];
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export async function saveExercises(exercises: ExerciseEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
}

export async function loadExercises(): Promise<ExerciseEntry[] | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
  if (!raw) return null;
  // Migrate: fill in `type` if missing (data saved before type field was added)
  const data = JSON.parse(raw) as Array<ExerciseEntry & { type?: ExerciseType }>;
  return data.map((e) => ({ ...e, type: e.type ?? 'normal' }));
}

// ─── Active Gym Session ───────────────────────────────────────────────────────

export async function saveActiveGymSession(session: GymSession | null): Promise<void> {
  if (session) {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_GYM_SESSION, JSON.stringify(session));
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_GYM_SESSION);
  }
}

export async function loadActiveGymSession(): Promise<GymSession | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_GYM_SESSION);
  return raw ? (JSON.parse(raw) as GymSession) : null;
}

// ─── Weights ──────────────────────────────────────────────────────────────────

export async function saveWeights(weights: WeightEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(weights));
}

export async function loadWeights(): Promise<WeightEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.WEIGHTS);
  if (!raw) return [];
  return JSON.parse(raw) as WeightEntry[];
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!raw) return {};
  return JSON.parse(raw) as AppSettings;
}

// ─── Initialization flag ──────────────────────────────────────────────────────

export async function isFirstLaunch(): Promise<boolean> {
  const val = await AsyncStorage.getItem(STORAGE_KEYS.IS_INITIALIZED);
  return val === null;
}

export async function markInitialized(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.IS_INITIALIZED, 'true');
}
