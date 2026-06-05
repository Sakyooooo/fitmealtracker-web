import { MealEntry, ExerciseEntry, WeightEntry, GymSession, MealAnalysisResult } from '@/lib/types';

let seq = 0;
const nextId = () => `test-${++seq}`;

export function makeMeal(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: nextId(),
    name: 'テスト食事',
    calories: 500,
    time: '12:00',
    category: '昼食',
    date: '2026-06-05',
    ...overrides,
  };
}

export function makeExercise(overrides: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return {
    id: nextId(),
    name: 'ランニング',
    durationMinutes: 30,
    caloriesBurned: 200,
    date: '2026-06-05',
    note: '',
    type: 'normal',
    ...overrides,
  };
}

export function makeWeight(overrides: Partial<WeightEntry> = {}): WeightEntry {
  return {
    id: nextId(),
    date: '2026-06-05',
    weightKg: 65.0,
    ...overrides,
  };
}

export function makeGymSession(overrides: Partial<GymSession> = {}): GymSession {
  return {
    id: nextId(),
    startedAt: new Date().toISOString(),
    status: 'active',
    ...overrides,
  };
}

export function makeAnalysisResult(overrides: Partial<MealAnalysisResult> = {}): MealAnalysisResult {
  return {
    dishName: 'サラダチキン',
    estimatedCalories: 200,
    confidence: 0.85,
    notes: null,
    protein: 30,
    fat: 5,
    carbs: 3,
    ...overrides,
  };
}
