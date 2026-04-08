'use client';

import { supabase } from './supabase';
import { MealEntry, ExerciseEntry, WeightEntry, GymSession, MealCategory } from './types';

// ── DB row types (snake_case) ────────────────────────────────────────────────

type MealRow = {
  id: string;
  dish_name: string;
  estimated_calories: number;
  eaten_at: string;
  meal_category: string;
  protein_gram: number | null;
  fat_gram: number | null;
  carb_gram: number | null;
  note: string | null;
  photo_url: string | null;
};

type ExerciseRow = {
  id: string;
  activity_type: string;
  started_at: string;
  duration_sec: number | null;
  estimated_calories_burned: number;
  note: string | null;
  source_type: string;
};

type WeightRow = {
  id: string;
  weight_kg: number;
  recorded_at: string;
  note: string | null;
};

type GymSessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  estimated_calories_burned: number | null;
  memo: string | null;
  status: string;
};

// ── Row → App type mappers ───────────────────────────────────────────────────

function rowToMeal(row: MealRow): MealEntry {
  return {
    id: row.id,
    name: row.dish_name,
    calories: Number(row.estimated_calories),
    // Supabase returns timestamptz as "YYYY-MM-DDTHH:MM:SS+00:00"
    date: row.eaten_at.slice(0, 10),
    time: row.eaten_at.slice(11, 16),
    category: row.meal_category as MealCategory,
    note: row.note ?? undefined,
    photoUri: row.photo_url ?? undefined,
    protein: row.protein_gram ?? undefined,
    fat: row.fat_gram ?? undefined,
    carbs: row.carb_gram ?? undefined,
  };
}

function rowToExercise(row: ExerciseRow): ExerciseEntry {
  return {
    id: row.id,
    name: row.activity_type,
    durationMinutes: Math.round((row.duration_sec ?? 0) / 60),
    caloriesBurned: Number(row.estimated_calories_burned),
    date: row.started_at.slice(0, 10),
    note: row.note ?? '',
    type: row.source_type as 'normal' | 'gymSession',
  };
}

function rowToWeight(row: WeightRow): WeightEntry {
  return {
    id: row.id,
    weightKg: Number(row.weight_kg),
    date: row.recorded_at.slice(0, 10),
    note: row.note ?? undefined,
  };
}

function rowToGymSession(row: GymSessionRow): GymSession {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    estimatedCaloriesBurned: row.estimated_calories_burned ?? undefined,
    memo: row.memo ?? undefined,
    status: row.status as GymSession['status'],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Meals ────────────────────────────────────────────────────────────────────

export async function dbFetchMeals(): Promise<MealEntry[]> {
  const { data, error } = await supabase
    .from('meal_records')
    .select('*')
    .order('eaten_at', { ascending: false });
  if (error) { console.error('[db] fetchMeals', error); return []; }
  return (data as MealRow[]).map(rowToMeal);
}

export async function dbInsertMeal(
  entry: Omit<MealEntry, 'id'>,
): Promise<MealEntry | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('meal_records')
    .insert({
      user_id: userId,
      dish_name: entry.name,
      estimated_calories: entry.calories,
      eaten_at: `${entry.date}T${entry.time}:00`,
      meal_category: entry.category,
      protein_gram: entry.protein ?? null,
      fat_gram: entry.fat ?? null,
      carb_gram: entry.carbs ?? null,
      note: entry.note ?? null,
      photo_url: entry.photoUri ?? null,
      estimation_source: 'manual',
    })
    .select()
    .single();

  if (error) { console.error('[db] insertMeal', error); return null; }
  return rowToMeal(data as MealRow);
}

export async function dbUpdateMeal(entry: MealEntry): Promise<MealEntry | null> {
  const { data, error } = await supabase
    .from('meal_records')
    .update({
      dish_name: entry.name,
      estimated_calories: entry.calories,
      eaten_at: `${entry.date}T${entry.time}:00`,
      meal_category: entry.category,
      protein_gram: entry.protein ?? null,
      fat_gram: entry.fat ?? null,
      carb_gram: entry.carbs ?? null,
      note: entry.note ?? null,
      photo_url: entry.photoUri ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entry.id)
    .select()
    .single();

  if (error) { console.error('[db] updateMeal', error); return null; }
  return rowToMeal(data as MealRow);
}

export async function dbDeleteMeal(id: string): Promise<boolean> {
  const { error } = await supabase.from('meal_records').delete().eq('id', id);
  if (error) { console.error('[db] deleteMeal', error); return false; }
  return true;
}

// ── Exercises ────────────────────────────────────────────────────────────────

export async function dbFetchExercises(): Promise<ExerciseEntry[]> {
  const { data, error } = await supabase
    .from('exercise_records')
    .select('*')
    .order('started_at', { ascending: false });
  if (error) { console.error('[db] fetchExercises', error); return []; }
  return (data as ExerciseRow[]).map(rowToExercise);
}

export async function dbInsertExercise(
  entry: Omit<ExerciseEntry, 'id'>,
): Promise<ExerciseEntry | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('exercise_records')
    .insert({
      user_id: userId,
      activity_type: entry.name,
      started_at: `${entry.date}T00:00:00`,
      duration_sec: entry.durationMinutes * 60,
      estimated_calories_burned: entry.caloriesBurned,
      note: entry.note ?? null,
      source_type: entry.type,
    })
    .select()
    .single();

  if (error) { console.error('[db] insertExercise', error); return null; }
  return rowToExercise(data as ExerciseRow);
}

export async function dbUpdateExercise(entry: ExerciseEntry): Promise<ExerciseEntry | null> {
  const { data, error } = await supabase
    .from('exercise_records')
    .update({
      activity_type: entry.name,
      started_at: `${entry.date}T00:00:00`,
      duration_sec: entry.durationMinutes * 60,
      estimated_calories_burned: entry.caloriesBurned,
      note: entry.note ?? null,
      source_type: entry.type,
    })
    .eq('id', entry.id)
    .select()
    .single();

  if (error) { console.error('[db] updateExercise', error); return null; }
  return rowToExercise(data as ExerciseRow);
}

export async function dbDeleteExercise(id: string): Promise<boolean> {
  const { error } = await supabase.from('exercise_records').delete().eq('id', id);
  if (error) { console.error('[db] deleteExercise', error); return false; }
  return true;
}

// ── Weights ──────────────────────────────────────────────────────────────────

export async function dbFetchWeights(): Promise<WeightEntry[]> {
  const { data, error } = await supabase
    .from('weight_records')
    .select('*')
    .order('recorded_at', { ascending: false });
  if (error) { console.error('[db] fetchWeights', error); return []; }
  return (data as WeightRow[]).map(rowToWeight);
}

export async function dbInsertWeight(
  entry: Omit<WeightEntry, 'id'>,
): Promise<WeightEntry | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('weight_records')
    .insert({
      user_id: userId,
      weight_kg: entry.weightKg,
      recorded_at: `${entry.date}T00:00:00`,
      note: entry.note ?? null,
    })
    .select()
    .single();

  if (error) { console.error('[db] insertWeight', error); return null; }
  return rowToWeight(data as WeightRow);
}

export async function dbDeleteWeight(id: string): Promise<boolean> {
  const { error } = await supabase.from('weight_records').delete().eq('id', id);
  if (error) { console.error('[db] deleteWeight', error); return false; }
  return true;
}

// ── Gym Sessions ─────────────────────────────────────────────────────────────

export async function dbFetchActiveGymSession(): Promise<GymSession | null> {
  const { data, error } = await supabase
    .from('gym_sessions')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();
  if (error) { console.error('[db] fetchActiveGymSession', error); return null; }
  return data ? rowToGymSession(data as GymSessionRow) : null;
}

export async function dbInsertGymSession(startedAt: string): Promise<GymSession | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('gym_sessions')
    .insert({
      user_id: userId,
      started_at: startedAt,
      status: 'active',
    })
    .select()
    .single();

  if (error) { console.error('[db] insertGymSession', error); return null; }
  return rowToGymSession(data as GymSessionRow);
}

export async function dbUpdateGymSession(session: GymSession): Promise<void> {
  const { error } = await supabase
    .from('gym_sessions')
    .update({
      ended_at: session.endedAt ?? null,
      duration_sec: session.durationSec ?? null,
      estimated_calories_burned: session.estimatedCaloriesBurned ?? null,
      memo: session.memo ?? null,
      status: session.status,
    })
    .eq('id', session.id);

  if (error) console.error('[db] updateGymSession', error);
}

export async function dbDeleteGymSession(id: string): Promise<void> {
  const { error } = await supabase.from('gym_sessions').delete().eq('id', id);
  if (error) console.error('[db] deleteGymSession', error);
}
