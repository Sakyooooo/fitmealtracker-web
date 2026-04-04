export type MealCategory = '朝食' | '昼食' | '夕食' | '間食';

export type MealEntry = {
  id: string;
  name: string;
  calories: number;
  time: string;      // "HH:MM"
  category: MealCategory;
  date: string;      // "YYYY-MM-DD"
  note?: string;
  photoUri?: string;
  protein?: number;  // g
  fat?: number;      // g
  carbs?: number;    // g
};

export type ExerciseType = 'normal' | 'gymSession';

export type ExerciseEntry = {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  date: string;      // "YYYY-MM-DD"
  note: string;
  type: ExerciseType;
};

export type WeightEntry = {
  id: string;
  date: string;      // "YYYY-MM-DD"
  weightKg: number;
  note?: string;
};

export type AppSettings = {
  targetWeightKg?: number;
  targetIntakeCalories?: number;
  targetBurnedCalories?: number;
  heightCm?: number;
  targetProtein?: number;
  targetFat?: number;
  targetCarbs?: number;
};

export type MealAnalysisResult = {
  dishName: string | null;
  estimatedCalories: number | null;
  confidence: number | null;
  notes: string | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
};

export type DayStat = {
  date: string;
  dayLabel: string;
  calories: number;
  burned: number;
};

export type GymSessionStatus = 'active' | 'completed' | 'canceled';

export type GymSession = {
  id: string;
  startedAt: string;       // ISO string
  endedAt?: string;        // ISO string
  durationSec?: number;
  estimatedCaloriesBurned?: number;
  memo?: string;
  status: GymSessionStatus;
};
