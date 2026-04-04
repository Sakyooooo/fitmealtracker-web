import { MealEntry, ExerciseEntry } from '../types';

export function sumProtein(meals: MealEntry[]): number {
  return Math.round(meals.reduce((s, m) => s + (m.protein ?? 0), 0) * 10) / 10;
}

export function sumFat(meals: MealEntry[]): number {
  return Math.round(meals.reduce((s, m) => s + (m.fat ?? 0), 0) * 10) / 10;
}

export function sumCarbs(meals: MealEntry[]): number {
  return Math.round(meals.reduce((s, m) => s + (m.carbs ?? 0), 0) * 10) / 10;
}

export function dateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return dateString();
}

export function getMealsByDate(meals: MealEntry[], date: string): MealEntry[] {
  return meals.filter((m) => m.date === date);
}

export function getExercisesByDate(exercises: ExerciseEntry[], date: string): ExerciseEntry[] {
  return exercises.filter((e) => e.date === date);
}

export function sumCalories(meals: MealEntry[]): number {
  return meals.reduce((sum, m) => sum + m.calories, 0);
}

export function sumBurned(exercises: ExerciseEntry[]): number {
  return exercises.reduce((sum, e) => sum + e.caloriesBurned, 0);
}

export function sumDuration(exercises: ExerciseEntry[]): number {
  return exercises.reduce((sum, e) => sum + e.durationMinutes, 0);
}

export type DayStat = {
  date: string;
  dayLabel: string;
  calories: number;
  burned: number;
};

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

export function getDatesWithRecords(
  meals: MealEntry[],
  exercises: ExerciseEntry[],
): Set<string> {
  const dates = new Set<string>();
  meals.forEach((m) => dates.add(m.date));
  exercises.forEach((e) => dates.add(e.date));
  return dates;
}

export function getDatesWithMeals(meals: MealEntry[]): Set<string> {
  const dates = new Set<string>();
  meals.forEach((m) => dates.add(m.date));
  return dates;
}

export function getDatesWithExercises(exercises: ExerciseEntry[]): Set<string> {
  const dates = new Set<string>();
  exercises.forEach((e) => dates.add(e.date));
  return dates;
}

/** 今日を起点に食事または運動記録がある連続日数を返す */
export function calcStreak(meals: MealEntry[], exercises: ExerciseEntry[]): number {
  const recorded = getDatesWithRecords(meals, exercises);
  let streak = 0;
  const cursor = new Date();
  // 今日に記録がない場合、昨日から遡る（当日未記録中でも前日のストリークを保持）
  const todayStr = dateString(cursor);
  if (!recorded.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const dStr = dateString(cursor);
    if (!recorded.has(dStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
    // 最大365日まで
    if (streak >= 365) break;
  }
  return streak;
}
