import { describe, it, expect } from 'vitest';
import {
  extractYouTubeVideoId,
  youtubeThumbnailUrl,
  normalizeRecipeAnalysis,
  combineRecipesForMeal,
  guessMealCategory,
} from './recipe';
import { Recipe } from './types';

// ── extractYouTubeVideoId ─────────────────────────────────────────────────────

describe('extractYouTubeVideoId', () => {
  it('watch URL から videoId を取り出す', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('クエリ付き watch URL でも v= を取り出す', () => {
    expect(
      extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s&list=PLx'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('youtu.be 短縮 URL に対応する', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
  });

  it('shorts / embed / live に対応する', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('モバイル (m.) と www なしに対応する', () => {
    expect(extractYouTubeVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('YouTube 以外の URL・不正入力は null', () => {
    expect(extractYouTubeVideoId('https://www.tiktok.com/@user/video/123')).toBeNull();
    expect(extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(extractYouTubeVideoId('not a url')).toBeNull();
    expect(extractYouTubeVideoId('https://www.youtube.com/watch')).toBeNull();
    expect(extractYouTubeVideoId('ftp://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('thumbnail URL を videoId から導出する', () => {
    expect(youtubeThumbnailUrl('abc123XYZ_-')).toBe('https://i.ytimg.com/vi/abc123XYZ_-/hqdefault.jpg');
  });
});

// ── normalizeRecipeAnalysis ───────────────────────────────────────────────────

describe('normalizeRecipeAnalysis', () => {
  it('正常な解析結果をそのまま整える', () => {
    const r = normalizeRecipeAnalysis({
      name: '肉じゃが',
      servings: 4,
      ingredients: [
        { name: '豚こま肉', amount: '200g' },
        { name: 'じゃがいも', amount: '3個' },
      ],
      steps: ['じゃがいもを切る', '煮る'],
      calories: 320,
      protein: 15.25,
      fat: 10,
      carbs: 40,
      notes: null,
    });
    expect(r.name).toBe('肉じゃが');
    expect(r.servings).toBe(4);
    expect(r.ingredients).toHaveLength(2);
    expect(r.steps).toEqual(['じゃがいもを切る', '煮る']);
    expect(r.calories).toBe(320);
    expect(r.protein).toBe(15.3); // 0.1g 丸め
  });

  it('壊れた値は落とす・デフォルトを入れる', () => {
    const r = normalizeRecipeAnalysis({
      name: '   ',
      servings: -2,
      ingredients: [{ name: '', amount: '10g' }, { name: '塩' }, 'garbage', null],
      steps: ['', '  焼く  ', 42],
      calories: -100,
      protein: 'many',
    });
    expect(r.name).toBeNull();
    expect(r.servings).toBe(1);
    expect(r.ingredients).toEqual([{ name: '塩', amount: null }]);
    expect(r.steps).toEqual(['焼く']);
    expect(r.calories).toBeNull();
    expect(r.protein).toBeNull();
  });

  it('null / undefined 入力でも安全', () => {
    const r = normalizeRecipeAnalysis(null);
    expect(r.name).toBeNull();
    expect(r.servings).toBe(1);
    expect(r.ingredients).toEqual([]);
    expect(r.steps).toEqual([]);
  });

  it('servings は 20 に上限クランプされる', () => {
    expect(normalizeRecipeAnalysis({ servings: 100 }).servings).toBe(20);
  });
});

// ── combineRecipesForMeal ─────────────────────────────────────────────────────

function makeRecipe(over: Partial<Recipe>): Recipe {
  return {
    id: 'r1',
    name: 'テスト料理',
    servings: 1,
    ingredients: [],
    steps: [],
    calories: 100,
    protein: 10,
    fat: 5,
    carbs: 20,
    sourceType: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('combineRecipesForMeal', () => {
  it('複数レシピを名前連結・栄養合算で1件にまとめる', () => {
    const meal = combineRecipesForMeal([
      { recipe: makeRecipe({ name: '肉じゃが', calories: 320, protein: 15, fat: 10, carbs: 40 }), quantity: 1 },
      { recipe: makeRecipe({ name: '味噌汁', calories: 60, protein: 4, fat: 2, carbs: 6 }), quantity: 1 },
    ]);
    expect(meal.name).toBe('肉じゃが、味噌汁');
    expect(meal.calories).toBe(380);
    expect(meal.protein).toBe(19);
    expect(meal.fat).toBe(12);
    expect(meal.carbs).toBe(46);
  });

  it('quantity 倍率を栄養に反映する', () => {
    const meal = combineRecipesForMeal([
      { recipe: makeRecipe({ calories: 200, protein: 10, fat: 8, carbs: 30 }), quantity: 1.5 },
    ]);
    expect(meal.calories).toBe(300);
    expect(meal.protein).toBe(15);
    expect(meal.fat).toBe(12);
    expect(meal.carbs).toBe(45);
  });

  it('一部レシピの PFC が null でも、値のあるレシピだけで合算する', () => {
    const meal = combineRecipesForMeal([
      { recipe: makeRecipe({ calories: 100, protein: 10, fat: null, carbs: null }), quantity: 1 },
      { recipe: makeRecipe({ calories: 50, protein: null, fat: null, carbs: 5 }), quantity: 2 },
    ]);
    expect(meal.calories).toBe(200);
    expect(meal.protein).toBe(10);   // 2件目は null → 0 扱い
    expect(meal.fat).toBeNull();     // 全件 null → null のまま
    expect(meal.carbs).toBe(10);
  });

  it('カロリー null のレシピは 0 kcal として扱う', () => {
    const meal = combineRecipesForMeal([
      { recipe: makeRecipe({ calories: null }), quantity: 1 },
      { recipe: makeRecipe({ calories: 150 }), quantity: 1 },
    ]);
    expect(meal.calories).toBe(150);
  });
});

// ── guessMealCategory ─────────────────────────────────────────────────────────

describe('guessMealCategory', () => {
  it('時間帯からカテゴリを推定する', () => {
    expect(guessMealCategory(7)).toBe('朝食');
    expect(guessMealCategory(12)).toBe('昼食');
    expect(guessMealCategory(19)).toBe('夕食');
    expect(guessMealCategory(23)).toBe('間食');
    expect(guessMealCategory(2)).toBe('間食');
  });

  it('境界値', () => {
    expect(guessMealCategory(4)).toBe('朝食');
    expect(guessMealCategory(10)).toBe('昼食');
    expect(guessMealCategory(15)).toBe('夕食');
    expect(guessMealCategory(22)).toBe('間食');
  });
});
