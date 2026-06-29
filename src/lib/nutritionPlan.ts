// 体格・目標から1日の栄養目標（摂取/消費カロリー・PFC）を算出する純粋ロジック。
// Mifflin-St Jeor で BMR → 活動係数で TDEE → 目標期間から必要なカロリー収支を求め、
// 「摂取を減らす／運動を増やす」の両方で赤字を分担する（減量時 50/50）。

import type { Sex, ActivityLevel } from './types';

export type { Sex, ActivityLevel };

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: 'sedentary', label: 'ほぼ運動しない', hint: '座り仕事中心' },
  { value: 'light', label: '軽い運動', hint: '週1〜3回の運動' },
  { value: 'moderate', label: '中程度', hint: '週3〜5回の運動' },
  { value: 'active', label: 'よく動く', hint: '週6〜7回の運動' },
];

const KCAL_PER_KG = 7700;        // 体脂肪1kgあたりのエネルギー
const MAX_DAILY_DEFICIT = 1000;  // 1日の赤字上限（健康的な減量ペース）
const GAIN_BURN_DEFAULT = 150;   // 増量・維持時の軽い運動目標
const PROTEIN_PER_KG = 1.6;      // 体重1kgあたりのタンパク質(g)
const FAT_RATIO = 0.25;          // 脂質は総摂取カロリーの25%

export type NutritionPlanInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  days: number; // 目標までの残日数
};

export type NutritionPlan = {
  bmr: number;
  tdee: number;
  targetIntakeCalories: number;
  targetBurnedCalories: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  dailyAdjustment: number; // 日次のカロリー調整（負=赤字 / 正=黒字）
  warnings: string[];
};

function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

/** Mifflin-St Jeor 式の基礎代謝量(BMR)。 */
export function computeBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** 目標日付（"YYYY-MM-DD"）までの残日数。過去日なら0以下になりうる。 */
export function daysUntil(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** 体格・目標から1日の栄養目標を算出する。 */
export function computeNutritionPlan(input: NutritionPlanInput): NutritionPlan {
  const { sex, age, heightCm, currentWeightKg, targetWeightKg, activityLevel, days } = input;
  const warnings: string[] = [];

  const bmr = computeBMR(sex, currentWeightKg, heightCm, age);
  const tdee = bmr * ACTIVITY_FACTORS[activityLevel];

  const safeDays = Math.max(1, days);
  const weightChange = targetWeightKg - currentWeightKg; // 負=減量 / 正=増量
  let dailyAdjustment = (weightChange * KCAL_PER_KG) / safeDays;

  // 減量ペースが速すぎる場合は健康的な上限にキャップ
  if (dailyAdjustment < -MAX_DAILY_DEFICIT) {
    dailyAdjustment = -MAX_DAILY_DEFICIT;
    warnings.push(
      '目標までの期間が短いため、1日あたり最大1000kcalの赤字に調整しました。期間を延ばすと無理なく達成できます。',
    );
  }

  let targetIntakeCalories: number;
  let targetBurnedCalories: number;

  if (dailyAdjustment < 0) {
    // 減量: 赤字を 食事 / 運動 の50/50で分担
    const deficit = -dailyAdjustment;
    targetIntakeCalories = tdee - deficit / 2;
    targetBurnedCalories = deficit / 2;

    // 摂取がBMRを下回らないようにクランプ（不足分は運動側へ寄せる）
    if (targetIntakeCalories < bmr) {
      const shortfall = bmr - targetIntakeCalories;
      targetIntakeCalories = bmr;
      targetBurnedCalories += shortfall;
      warnings.push('摂取カロリーが基礎代謝を下回らないよう調整し、不足分を運動目標に振り分けました。');
    }
  } else if (dailyAdjustment > 0) {
    // 増量: 黒字は摂取で確保。運動は軽めの維持目標
    targetIntakeCalories = tdee + dailyAdjustment;
    targetBurnedCalories = GAIN_BURN_DEFAULT;
  } else {
    // 維持
    targetIntakeCalories = tdee;
    targetBurnedCalories = GAIN_BURN_DEFAULT;
  }

  // PFC: タンパク質は体重ベース、脂質は総摂取の25%、残りを炭水化物に
  const protein = currentWeightKg * PROTEIN_PER_KG;
  const fat = (targetIntakeCalories * FAT_RATIO) / 9;
  const carbs = Math.max(0, (targetIntakeCalories - protein * 4 - fat * 9) / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetIntakeCalories: round10(targetIntakeCalories),
    targetBurnedCalories: round10(targetBurnedCalories),
    targetProtein: Math.round(protein),
    targetFat: Math.round(fat),
    targetCarbs: Math.round(carbs),
    dailyAdjustment: Math.round(dailyAdjustment),
    warnings,
  };
}
