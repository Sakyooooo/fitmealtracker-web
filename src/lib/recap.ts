import { MealEntry, ExerciseEntry, AppSettings, MealCategory } from './types';
import {
  calcStreak,
  getMealsByDate,
  getExercisesByDate,
  sumCalories,
  sumBurned,
  sumProtein,
} from './stats';

// ── 1日1回ポップアップのフラグ ───────────────────────────────────────────────
const RECAP_SHOWN_KEY = 'fmt_recap_shown_date';

export function getRecapShownDate(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(RECAP_SHOWN_KEY);
  } catch {
    return null;
  }
}

export function setRecapShownDate(date: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECAP_SHOWN_KEY, date);
  } catch {
    /* ignore quota errors — 振り返りの表示記録は失っても害が無い */
  }
}

// ── 1枚 = 1記録のカード ───────────────────────────────────────────────────────
export type RecapMealRecord = {
  kind: 'meal';
  id: string;
  category: MealCategory;
  time: string;
  name: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  note?: string;
  photoUrl?: string;
};

export type RecapExerciseRecord = {
  kind: 'exercise';
  id: string;
  name: string;
  calories: number; // 消費 kcal
  durationMinutes: number;
  note?: string;
};

export type RecapRecord = RecapMealRecord | RecapExerciseRecord;

// ── 健康スコア ─────────────────────────────────────────────────────────────────
export type ScoreBreakdown = { key: string; label: string; pct: number };

export type HealthScore = {
  total: number; // 0–100
  label: string;
  message: string;
  color: string;
  breakdown: ScoreBreakdown[];
};

export type RecapSummary = {
  intake: number;
  burned: number;
  mealCount: number;
  exerciseCount: number;
};

export type RecapData = {
  date: string;
  dateLabel: string;
  records: RecapRecord[];
  summary: RecapSummary;
  streak: number;
  score: HealthScore;
};

// ── スコアの重み（調整しやすいよう定数で外出し） ─────────────────────────────
const WEIGHTS = { meal: 0.3, protein: 0.25, activity: 0.25, consistency: 0.2 } as const;
const DEFAULT_TARGET_PROTEIN = 60;
const FALLBACK_BURN_TARGET = 300; // 消費目標が未設定のときの基準
const STREAK_FULL_DAYS = 7; // 継続スコアが満点になる連続日数

const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_LABELS[d.getDay()]}曜日`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** 0–100 の健康スコアを算出。目標未設定の項目は妥当なフォールバックで採点する。 */
export function computeHealthScore(
  meals: MealEntry[],
  exercises: ExerciseEntry[],
  settings: AppSettings,
  streak: number,
): HealthScore {
  const intake = sumCalories(meals);
  const burned = sumBurned(exercises);
  const protein = sumProtein(meals);

  // 食事: 目標摂取があれば「目標との近さ」、無ければ記録した食事数で採点
  const targetIntake = settings.targetIntakeCalories;
  let mealScore: number;
  if (targetIntake && targetIntake > 0) {
    mealScore = intake === 0 ? 0 : clamp01(1 - Math.abs(intake - targetIntake) / targetIntake);
  } else {
    mealScore = clamp01(meals.length / 3);
  }

  // タンパク質: 目標（既定 60g）に対する達成率
  const targetProtein = settings.targetProtein ?? DEFAULT_TARGET_PROTEIN;
  const proteinScore = clamp01(protein / targetProtein);

  // 運動: 目標消費があればその達成率、無ければ運動の有無＋消費量
  const targetBurn = settings.targetBurnedCalories;
  let activityScore: number;
  if (targetBurn && targetBurn > 0) {
    activityScore = clamp01(burned / targetBurn);
  } else {
    activityScore = exercises.length === 0 ? 0 : clamp01(burned / FALLBACK_BURN_TARGET);
  }

  // 継続: STREAK_FULL_DAYS 連続で満点
  const consistencyScore = clamp01(streak / STREAK_FULL_DAYS);

  const total = Math.round(
    (mealScore * WEIGHTS.meal +
      proteinScore * WEIGHTS.protein +
      activityScore * WEIGHTS.activity +
      consistencyScore * WEIGHTS.consistency) *
      100,
  );

  const { label, message, color } = scoreTier(total);

  return {
    total,
    label,
    message,
    color,
    breakdown: [
      { key: 'meal', label: '食事', pct: Math.round(mealScore * 100) },
      { key: 'protein', label: 'タンパク質', pct: Math.round(proteinScore * 100) },
      { key: 'activity', label: '運動', pct: Math.round(activityScore * 100) },
      { key: 'consistency', label: '継続', pct: Math.round(consistencyScore * 100) },
    ],
  };
}

function scoreTier(total: number): { label: string; message: string; color: string } {
  if (total >= 85) return { label: 'PERFECT', message: '完璧な一日！', color: '#4CAF50' };
  if (total >= 70) return { label: 'GREAT', message: 'よく頑張りました', color: '#66BB6A' };
  if (total >= 50) return { label: 'GOOD', message: 'いいペースです', color: '#FFA726' };
  return { label: 'KEEP GOING', message: '記録できたことが第一歩', color: '#AB47BC' };
}

/** 指定日の食事・運動から、振り返りカードに必要なデータ一式を組み立てる。 */
export function buildRecapData(
  meals: MealEntry[],
  exercises: ExerciseEntry[],
  settings: AppSettings,
  date: string,
): RecapData {
  const dayMeals = getMealsByDate(meals, date);
  const dayEx = getExercisesByDate(exercises, date);

  const mealRecords: RecapRecord[] = dayMeals
    .map((m): RecapMealRecord => ({
      kind: 'meal',
      id: m.id,
      category: m.category,
      time: m.time,
      name: m.name,
      calories: m.calories,
      protein: m.protein ?? null,
      fat: m.fat ?? null,
      carbs: m.carbs ?? null,
      note: m.note,
      photoUrl: m.photoUri ?? m.photoUrl ?? undefined,
    }))
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

  // 運動は時刻フィールドが無いため、記録の古い順（挿入は新しい順なので反転）で食事の後ろへ
  const exRecords: RecapRecord[] = [...dayEx]
    .reverse()
    .map((e): RecapExerciseRecord => ({
      kind: 'exercise',
      id: e.id,
      name: e.name,
      calories: e.caloriesBurned,
      durationMinutes: e.durationMinutes,
      note: e.note || undefined,
    }));

  const streak = calcStreak(meals, exercises);

  return {
    date,
    dateLabel: formatDateLabel(date),
    records: [...mealRecords, ...exRecords],
    summary: {
      intake: sumCalories(dayMeals),
      burned: sumBurned(dayEx),
      mealCount: dayMeals.length,
      exerciseCount: dayEx.length,
    },
    streak,
    score: computeHealthScore(dayMeals, dayEx, settings, streak),
  };
}
