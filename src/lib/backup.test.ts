import { describe, it, expect, vi } from 'vitest';

// fake-indexeddb は jsdom の File/Blob を構造化クローンできない（実ブラウザの
// IndexedDB は Blob ネイティブ対応）ため、画像ストアはインメモリ実装に差し替えて
// バックアップのオーケストレーション（収集・直列化・復元）を検証する。
vi.mock('./imageStore', () => {
  type Rec = { id: string; blob: Blob; mimeType: string; createdAt: string };
  const store = new Map<string, Rec>();
  let seq = 0;
  return {
    saveImage: async (file: File) => {
      const id = `img-${++seq}`;
      store.set(id, {
        id, blob: file,
        mimeType: file.type || 'image/jpeg',
        createdAt: new Date().toISOString(),
      });
      return id;
    },
    getImageObjectUrl: async (id: string) => (store.has(id) ? `blob:mock-${id}` : null),
    deleteImage: async (id: string) => { store.delete(id); },
    getStoredImage: async (id: string) => store.get(id) ?? null,
    importImage: async (image: Rec) => { store.set(image.id, image); },
  };
});
import {
  createFullBackup,
  restoreFullBackup,
  isFullBackup,
  getBackupStatus,
  markBackupDone,
} from './backup';
import {
  insertMeal,
  insertExercise,
  insertWeight,
  fetchMealsRaw,
  fetchExercises,
  fetchWeights,
  loadSettings,
  saveSettings,
  upsertMyFoodLocal,
  fetchMyFoodsLocal,
} from './localRepository';
import { getStoredImage, deleteImage } from './imageStore';
import { makeMeal, makeExercise } from '@/test/factories';
import type { MyFood } from './types';

function newMealInput(over: Parameters<typeof makeMeal>[0] = {}, photoFile: File | null = null) {
  const { id: _id, photoId: _p, photoUri: _u, ...input } = makeMeal(over);
  void _id; void _p; void _u;
  return { ...input, photoFile };
}

function newExerciseInput() {
  const { id: _id, ...input } = makeExercise({ name: 'スクワット' });
  void _id;
  return input;
}

const MY_FOOD: MyFood = {
  id: 'mf-1',
  name: 'プロテイン',
  basis: 'serving',
  servingLabel: '1杯',
  calories: 120,
  protein: 24,
  fat: 2,
  carbs: 4,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('backup — 完全バックアップのラウンドトリップ', () => {
  it('記録・設定・マイ食品・写真を含めて作成→復元できる', async () => {
    // 1. データを仕込む（写真付き食事1件を含む）
    const photo = new File(['fake-jpeg-bytes'], 'meal.jpg', { type: 'image/jpeg' });
    const meal = await insertMeal(newMealInput({ name: '焼き鮭定食', calories: 620 }, photo));
    await insertExercise(newExerciseInput());
    await insertWeight({ date: '2026-06-10', weightKg: 64.2 });
    saveSettings({ targetIntakeCalories: 2100 });
    upsertMyFoodLocal(MY_FOOD);

    expect(meal.photoId).toBeTruthy();

    // 2. バックアップ作成
    const backup = await createFullBackup();
    expect(isFullBackup(backup)).toBe(true);
    expect(backup.meals).toHaveLength(1);
    expect(backup.meals[0].photoUri).toBeUndefined(); // 実行時 URL は含めない
    expect(backup.exercises).toHaveLength(1);
    expect(backup.weights).toHaveLength(1);
    expect(backup.myFoods).toHaveLength(1);
    expect(backup.photos).toHaveLength(1);
    expect(backup.photos[0].id).toBe(meal.photoId);
    expect(backup.photos[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);

    // 3. データ消失をシミュレート（localStorage 全消去＋写真削除）
    localStorage.clear();
    await deleteImage(meal.photoId!);
    expect(fetchMealsRaw()).toHaveLength(0);
    expect(await getStoredImage(meal.photoId!)).toBeNull();

    // 4. 復元
    const summary = await restoreFullBackup(backup);
    expect(summary).toEqual({ meals: 1, exercises: 1, weights: 1, myFoods: 1, photos: 1 });

    const meals = fetchMealsRaw();
    expect(meals).toHaveLength(1);
    expect(meals[0].name).toBe('焼き鮭定食');
    expect(meals[0].photoId).toBe(meal.photoId); // 写真参照が維持される
    expect(await fetchExercises()).toHaveLength(1);
    expect(await fetchWeights()).toHaveLength(1);
    expect(fetchMyFoodsLocal()).toHaveLength(1);
    expect(loadSettings().targetIntakeCalories).toBe(2100);

    const restored = await getStoredImage(meal.photoId!);
    expect(restored).not.toBeNull();
    expect(restored!.mimeType).toBe('image/jpeg');
  });

  it('復元は重複（同じ id）を自動スキップする', async () => {
    await insertMeal(newMealInput({ name: 'A' }));
    const backup = await createFullBackup();
    await restoreFullBackup(backup); // 消さずにそのまま復元
    expect(fetchMealsRaw()).toHaveLength(1);
  });

  it('復元時、ローカルの設定が優先され欠けだけ補完される', async () => {
    saveSettings({ targetIntakeCalories: 1800 });
    const backup = await createFullBackup();
    saveSettings({ targetIntakeCalories: 2000, heightCm: 172 });
    await restoreFullBackup(backup);
    const s = loadSettings();
    expect(s.targetIntakeCalories).toBe(2000); // ローカル優先
    expect(s.heightCm).toBe(172);              // ローカルにしかない値は残る
  });
});

describe('backup — 形式判定', () => {
  it('旧エクスポート形式は完全バックアップと判定しない', () => {
    expect(isFullBackup({ meals: [makeMeal()], exercises: [] })).toBe(false);
    expect(isFullBackup(null)).toBe(false);
    expect(isFullBackup('x')).toBe(false);
  });
});

describe('backup — バックアップ推奨判定', () => {
  it('未バックアップでも記録が少なければ推奨しない', () => {
    expect(getBackupStatus(2).due).toBe(false);
  });

  it('未バックアップで記録が5件以上なら推奨する', () => {
    const s = getBackupStatus(8);
    expect(s.due).toBe(true);
    expect(s.lastBackupAt).toBeNull();
  });

  it('バックアップ直後は推奨しない', () => {
    markBackupDone(8);
    const s = getBackupStatus(10);
    expect(s.due).toBe(false);
    expect(s.daysSince).toBe(0);
  });

  it('7日以上経過し記録が増えていれば推奨する', () => {
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
    localStorage.setItem('fmt_backup_meta', JSON.stringify({ lastBackupAt: old, totalAtBackup: 5 }));
    expect(getBackupStatus(9).due).toBe(true);   // 増えている → 推奨
    expect(getBackupStatus(5).due).toBe(false);  // 増えていない → 不要
  });
});
