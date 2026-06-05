import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calcStreak, sumCalories, sumBurned, sumProtein, sumFat, sumCarbs,
  getMealsByDate, getExercisesByDate, getRecentDayStats,
  calcBMI, bmiCategory, dateString,
} from './stats';
import { makeMeal, makeExercise } from '@/test/factories';

// テスト中の「今日」を固定
const TODAY = '2026-06-05';
const YESTERDAY = '2026-06-04';
const TWO_DAYS_AGO = '2026-06-03';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getMealsByDate', () => {
  it('指定日の食事のみ返す', () => {
    const meals = [
      makeMeal({ date: TODAY }),
      makeMeal({ date: YESTERDAY }),
      makeMeal({ date: TODAY }),
    ];
    expect(getMealsByDate(meals, TODAY)).toHaveLength(2);
  });

  it('空配列に対して空配列を返す', () => {
    expect(getMealsByDate([], TODAY)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getExercisesByDate', () => {
  it('指定日の運動のみ返す', () => {
    const exercises = [
      makeExercise({ date: TODAY }),
      makeExercise({ date: YESTERDAY }),
    ];
    expect(getExercisesByDate(exercises, TODAY)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sumCalories', () => {
  it('空配列は 0', () => {
    expect(sumCalories([])).toBe(0);
  });

  it('複数食事のカロリーを合算する', () => {
    const meals = [makeMeal({ calories: 300 }), makeMeal({ calories: 200 }), makeMeal({ calories: 100 })];
    expect(sumCalories(meals)).toBe(600);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sumBurned', () => {
  it('空配列は 0', () => {
    expect(sumBurned([])).toBe(0);
  });

  it('複数運動の消費カロリーを合算する', () => {
    const exercises = [makeExercise({ caloriesBurned: 150 }), makeExercise({ caloriesBurned: 250 })];
    expect(sumBurned(exercises)).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sumProtein / sumFat / sumCarbs', () => {
  it('PFC が undefined の食事を 0 として合算する', () => {
    const meals = [
      makeMeal({ protein: 20, fat: 10, carbs: 50 }),
      makeMeal({ protein: undefined, fat: undefined, carbs: undefined }),
    ];
    expect(sumProtein(meals)).toBe(20);
    expect(sumFat(meals)).toBe(10);
    expect(sumCarbs(meals)).toBe(50);
  });

  it('小数点1桁に丸める', () => {
    const meals = [makeMeal({ protein: 10.15 }), makeMeal({ protein: 10.05 })];
    // 10.15 + 10.05 = 20.2 → Math.round(20.2 * 10) / 10 = 20.2
    expect(sumProtein(meals)).toBe(20.2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('calcStreak', () => {
  it('空の場合は 0 を返す', () => {
    expect(calcStreak([], [])).toBe(0);
  });

  it('今日のみ記録があれば 1 を返す', () => {
    const meals = [makeMeal({ date: TODAY })];
    expect(calcStreak(meals, [])).toBe(1);
  });

  it('昨日のみ記録があれば 1 を返す（今日未記録）', () => {
    const meals = [makeMeal({ date: YESTERDAY })];
    expect(calcStreak(meals, [])).toBe(1);
  });

  it('今日・昨日連続して記録があれば 2 を返す', () => {
    const meals = [makeMeal({ date: TODAY }), makeMeal({ date: YESTERDAY })];
    expect(calcStreak(meals, [])).toBe(2);
  });

  it('今日・一昨日（昨日抜け）は連続カウントを 1 にとどめる', () => {
    const meals = [makeMeal({ date: TODAY }), makeMeal({ date: TWO_DAYS_AGO })];
    expect(calcStreak(meals, [])).toBe(1);
  });

  it('食事と運動を合算してストリークを計算する', () => {
    const meals = [makeMeal({ date: TODAY })];
    const exercises = [makeExercise({ date: YESTERDAY }), makeExercise({ date: TWO_DAYS_AGO })];
    expect(calcStreak(meals, exercises)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getRecentDayStats', () => {
  it('指定日数分の DayStat を返す', () => {
    const stats = getRecentDayStats([], [], 7);
    expect(stats).toHaveLength(7);
    // 最後の要素が今日
    expect(stats[6].date).toBe(TODAY);
  });

  it('各日のカロリー・消費カロリーが集計される', () => {
    const meals = [makeMeal({ date: TODAY, calories: 800 })];
    const exercises = [makeExercise({ date: TODAY, caloriesBurned: 300 })];
    const stats = getRecentDayStats(meals, exercises, 1);
    expect(stats[0].calories).toBe(800);
    expect(stats[0].burned).toBe(300);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('calcBMI', () => {
  it('BMI を正しく計算する（身長170cm・体重65kg → 22.5）', () => {
    expect(calcBMI(65, 170)).toBe(22.5);
  });
});

describe('bmiCategory', () => {
  it('18.5 未満 → 低体重', () => {
    expect(bmiCategory(18.4).label).toBe('低体重');
  });
  it('18.5〜25 → 普通体重', () => {
    expect(bmiCategory(22).label).toBe('普通体重');
  });
  it('25〜30 → 肥満（1度）', () => {
    expect(bmiCategory(27).label).toBe('肥満（1度）');
  });
  it('30 以上 → 肥満（2度以上）', () => {
    expect(bmiCategory(32).label).toBe('肥満（2度以上）');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('dateString', () => {
  it('Date オブジェクトを YYYY-MM-DD 形式にフォーマットする', () => {
    expect(dateString(new Date('2026-01-05T00:00:00'))).toBe('2026-01-05');
    expect(dateString(new Date('2026-12-31T00:00:00'))).toBe('2026-12-31');
  });
});
