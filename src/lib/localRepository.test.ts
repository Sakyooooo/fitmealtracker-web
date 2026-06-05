import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchMeals, insertMeal, updateMeal, deleteMeal,
  fetchExercises, insertExercise, deleteExercise,
  fetchWeights, insertWeight, deleteWeight,
  loadSettings, saveSettings,
  bulkImportMeals, bulkImportExercises,
} from './localRepository';
import { makeMeal, makeExercise, makeWeight } from '@/test/factories';

// ─────────────────────────────────────────────────────────────────────────────
describe('Meals CRUD', () => {
  it('insertMeal → fetchMeals で取得できる', async () => {
    await insertMeal({ name: 'おにぎり', calories: 200, time: '08:00', category: '朝食', date: '2026-06-05' });
    const meals = await fetchMeals();
    expect(meals).toHaveLength(1);
    expect(meals[0].name).toBe('おにぎり');
  });

  it('insertMeal は id を自動付与する', async () => {
    const saved = await insertMeal({ name: 'テスト', calories: 100, time: '12:00', category: '昼食', date: '2026-06-05' });
    expect(saved.id).toBeTruthy();
  });

  it('updateMeal で名前を更新できる', async () => {
    const saved = await insertMeal({ name: '旧名', calories: 100, time: '12:00', category: '昼食', date: '2026-06-05' });
    await updateMeal({ ...saved, name: '新名' });
    const meals = await fetchMeals();
    expect(meals.find(m => m.id === saved.id)?.name).toBe('新名');
  });

  it('deleteMeal で削除できる', async () => {
    const saved = await insertMeal({ name: '削除対象', calories: 100, time: '12:00', category: '昼食', date: '2026-06-05' });
    await deleteMeal(saved.id);
    const meals = await fetchMeals();
    expect(meals.find(m => m.id === saved.id)).toBeUndefined();
  });

  it('fetchMeals: 初期状態は空配列', async () => {
    const meals = await fetchMeals();
    expect(meals).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Exercises CRUD', () => {
  it('insertExercise → fetchExercises で取得できる', async () => {
    await insertExercise({ name: 'ランニング', durationMinutes: 30, caloriesBurned: 200, date: '2026-06-05', note: '', type: 'normal' });
    const exercises = await fetchExercises();
    expect(exercises).toHaveLength(1);
    expect(exercises[0].name).toBe('ランニング');
  });

  it('deleteExercise で削除できる', async () => {
    const saved = await insertExercise({ name: '削除', durationMinutes: 10, caloriesBurned: 50, date: '2026-06-05', note: '', type: 'normal' });
    await deleteExercise(saved.id);
    const exercises = await fetchExercises();
    expect(exercises.find(e => e.id === saved.id)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Weights CRUD', () => {
  it('insertWeight → fetchWeights で取得できる', async () => {
    await insertWeight({ date: '2026-06-05', weightKg: 65.0 });
    const weights = await fetchWeights();
    expect(weights).toHaveLength(1);
    expect(weights[0].weightKg).toBe(65.0);
  });

  it('deleteWeight で削除できる', async () => {
    const saved = await insertWeight({ date: '2026-06-05', weightKg: 70.0 });
    await deleteWeight(saved.id);
    const weights = await fetchWeights();
    expect(weights.find(w => w.id === saved.id)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Settings', () => {
  it('saveSettings → loadSettings でラウンドトリップできる', () => {
    saveSettings({ targetIntakeCalories: 2000, heightCm: 170 });
    const loaded = loadSettings();
    expect(loaded.targetIntakeCalories).toBe(2000);
    expect(loaded.heightCm).toBe(170);
  });

  it('何も保存していない場合は空オブジェクトを返す', () => {
    expect(loadSettings()).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('bulkImportMeals', () => {
  it('新しい食事データを一括インポートできる', async () => {
    const meals = [makeMeal({ id: 'import-1', date: '2026-06-01' }), makeMeal({ id: 'import-2', date: '2026-06-02' })];
    await bulkImportMeals(meals);
    const fetched = await fetchMeals();
    expect(fetched).toHaveLength(2);
  });

  it('重複 id はスキップされる', async () => {
    const meal = makeMeal({ id: 'dup-1' });
    // bulkImport で既知 id の食事を先に投入
    await bulkImportMeals([meal]);
    // 同じ id で別名を持つ食事をインポートしても上書きされない
    await bulkImportMeals([{ ...meal, name: '上書きされない' }]);
    const fetched = await fetchMeals();
    expect(fetched).toHaveLength(1);
    expect(fetched[0].name).not.toBe('上書きされない');
  });
});

describe('bulkImportExercises', () => {
  it('新しい運動データを一括インポートできる', async () => {
    const exercises = [makeExercise({ id: 'ex-import-1' }), makeExercise({ id: 'ex-import-2' })];
    await bulkImportExercises(exercises);
    const fetched = await fetchExercises();
    expect(fetched).toHaveLength(2);
  });

  it('重複 id はスキップされる', async () => {
    const exercise = makeExercise({ id: 'ex-dup-1' });
    await bulkImportExercises([exercise]);
    await bulkImportExercises([{ ...exercise, name: '上書きされない' }]);
    const fetched = await fetchExercises();
    expect(fetched).toHaveLength(1);
    expect(fetched[0].name).not.toBe('上書きされない');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('QuotaExceededError ハンドリング', () => {
  it('localStorage が容量超過したとき日本語エラーをスローする', async () => {
    // MemoryStorage インスタンスの setItem を直接スパイする
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    await expect(
      insertMeal({ name: '容量超過テスト', calories: 100, time: '12:00', category: '昼食', date: '2026-06-05' }),
    ).rejects.toThrow('ストレージの空き容量が不足しています');
  });
});
