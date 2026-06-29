import { describe, it, expect } from 'vitest';
import { computeBMR, computeNutritionPlan, ACTIVITY_FACTORS } from './nutritionPlan';

describe('computeBMR (Mifflin-St Jeor)', () => {
  it('男性の手計算と一致する', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(computeBMR('male', 80, 180, 30)).toBe(1780);
  });

  it('女性の手計算と一致する', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
    expect(computeBMR('female', 60, 165, 30)).toBeCloseTo(1320.25);
  });
});

describe('computeNutritionPlan', () => {
  it('TDEE = BMR × 活動係数', () => {
    const plan = computeNutritionPlan({
      sex: 'male', age: 30, heightCm: 180, currentWeightKg: 80,
      targetWeightKg: 80, activityLevel: 'light', days: 90,
    });
    expect(plan.bmr).toBe(1780);
    expect(plan.tdee).toBe(Math.round(1780 * ACTIVITY_FACTORS.light)); // 2448
  });

  it('減量: 摂取<TDEE かつ 純赤字 = 必要赤字', () => {
    const plan = computeNutritionPlan({
      sex: 'male', age: 30, heightCm: 180, currentWeightKg: 80,
      targetWeightKg: 76, activityLevel: 'light', days: 60,
    });
    // 体重変化 -4kg / 60日 → 日次 -30800/60 ≈ -513kcal
    expect(plan.dailyAdjustment).toBeLessThan(0);
    expect(plan.targetIntakeCalories).toBeLessThan(plan.tdee);
    expect(plan.targetBurnedCalories).toBeGreaterThan(0);
    // 純赤字 = TDEE + 消費目標 − 摂取目標 ≈ |日次調整|（複数回の丸めで±20まで許容）
    const net = plan.tdee + plan.targetBurnedCalories - plan.targetIntakeCalories;
    expect(Math.abs(net - Math.abs(plan.dailyAdjustment))).toBeLessThanOrEqual(20);
  });

  it('減量赤字を食事と運動で半分ずつ分担する', () => {
    const plan = computeNutritionPlan({
      sex: 'male', age: 30, heightCm: 180, currentWeightKg: 80,
      targetWeightKg: 76, activityLevel: 'light', days: 60,
    });
    const fromDiet = plan.tdee - plan.targetIntakeCalories;
    expect(Math.abs(fromDiet - plan.targetBurnedCalories)).toBeLessThanOrEqual(20);
  });

  it('過度な赤字はキャップされ警告が出る', () => {
    const plan = computeNutritionPlan({
      sex: 'female', age: 30, heightCm: 165, currentWeightKg: 60,
      targetWeightKg: 50, activityLevel: 'sedentary', days: 14, // 非現実的に短い
    });
    expect(plan.dailyAdjustment).toBe(-1000); // キャップ
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('摂取はBMRを下回らない', () => {
    const plan = computeNutritionPlan({
      sex: 'female', age: 30, heightCm: 165, currentWeightKg: 60,
      targetWeightKg: 50, activityLevel: 'sedentary', days: 14,
    });
    expect(plan.targetIntakeCalories).toBeGreaterThanOrEqual(plan.bmr);
  });

  it('増量: 摂取>TDEE、消費目標は軽め', () => {
    const plan = computeNutritionPlan({
      sex: 'male', age: 25, heightCm: 175, currentWeightKg: 60,
      targetWeightKg: 65, activityLevel: 'moderate', days: 90,
    });
    expect(plan.dailyAdjustment).toBeGreaterThan(0);
    expect(plan.targetIntakeCalories).toBeGreaterThan(plan.tdee);
    expect(plan.targetBurnedCalories).toBe(150);
  });

  it('維持: 摂取=TDEE', () => {
    const plan = computeNutritionPlan({
      sex: 'male', age: 30, heightCm: 180, currentWeightKg: 80,
      targetWeightKg: 80, activityLevel: 'light', days: 90,
    });
    expect(plan.dailyAdjustment).toBe(0);
    expect(plan.targetIntakeCalories).toBe(Math.round(plan.tdee / 10) * 10);
  });

  it('PFC: タンパク質は体重×1.6、合計カロリーが摂取目標と概ね一致', () => {
    const plan = computeNutritionPlan({
      sex: 'male', age: 30, heightCm: 180, currentWeightKg: 80,
      targetWeightKg: 76, activityLevel: 'light', days: 60,
    });
    expect(plan.targetProtein).toBe(Math.round(80 * 1.6)); // 128
    const pfcCalories = plan.targetProtein * 4 + plan.targetFat * 9 + plan.targetCarbs * 4;
    // 丸めによる誤差は±30kcal程度に収まる
    expect(Math.abs(pfcCalories - plan.targetIntakeCalories)).toBeLessThan(30);
  });
});
