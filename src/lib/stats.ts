import { MealEntry, ExerciseEntry, DayStat } from './types';

export function todayString(): string {
  return dateString(new Date());
}

export function dateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMealsByDate(meals: MealEntry[], date: string): MealEntry[] {
  return meals.filter((m) => m.date === date);
}

export function getExercisesByDate(exercises: ExerciseEntry[], date: string): ExerciseEntry[] {
  return exercises.filter((e) => e.date === date);
}

export function sumCalories(meals: MealEntry[]): number {
  return meals.reduce((s, m) => s + m.calories, 0);
}

export function sumBurned(exercises: ExerciseEntry[]): number {
  return exercises.reduce((s, e) => s + e.caloriesBurned, 0);
}

export function sumProtein(meals: MealEntry[]): number {
  return Math.round(meals.reduce((s, m) => s + (m.protein ?? 0), 0) * 10) / 10;
}

export function sumFat(meals: MealEntry[]): number {
  return Math.round(meals.reduce((s, m) => s + (m.fat ?? 0), 0) * 10) / 10;
}

export function sumCarbs(meals: MealEntry[]): number {
  return Math.round(meals.reduce((s, m) => s + (m.carbs ?? 0), 0) * 10) / 10;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export function getRecentDayStats(
  meals: MealEntry[],
  exercises: ExerciseEntry[],
  days: number,
): DayStat[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const date = dateString(d);
    return {
      date,
      dayLabel: DAY_LABELS[d.getDay()],
      calories: sumCalories(getMealsByDate(meals, date)),
      burned: sumBurned(getExercisesByDate(exercises, date)),
    };
  });
}

export function calcStreak(meals: MealEntry[], exercises: ExerciseEntry[]): number {
  const recorded = new Set<string>();
  meals.forEach((m) => recorded.add(m.date));
  exercises.forEach((e) => recorded.add(e.date));

  let streak = 0;
  const cursor = new Date();
  if (!recorded.has(dateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (streak < 365) {
    if (!recorded.has(dateString(cursor))) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function calcBMI(weightKg: number, heightCm: number): number {
  const hm = heightCm / 100;
  return Math.round((weightKg / (hm * hm)) * 10) / 10;
}

export function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: '低体重', color: '#42A5F5' };
  if (bmi < 25)   return { label: '普通体重', color: '#4CAF50' };
  if (bmi < 30)   return { label: '肥満（1度）', color: '#FFA726' };
  return              { label: '肥満（2度以上）', color: '#EF5350' };
}
