import {
  MealAnalysisResult,
  ProductLookupResult,
  FoodCompositionItem,
  MyFood,
  NutritionBasis,
} from './types';
import { NutritionEntry } from './nutritionDb';

const round1 = (x: number | null): number | null =>
  x == null ? null : Math.round(x * 10) / 10;

/** 基準量 × 分量 で実際の栄養値を算出する。 */
export function scaleNutrition(b: NutritionBasis): {
  kcal: number;
  p: number | null;
  f: number | null;
  c: number | null;
} {
  const factor = b.unit === '100g' ? b.quantity / 100 : b.quantity;
  return {
    kcal: Math.round(b.base.kcal * factor),
    p: round1(b.base.p == null ? null : b.base.p * factor),
    f: round1(b.base.f == null ? null : b.base.f * factor),
    c: round1(b.base.c == null ? null : b.base.c * factor),
  };
}

/** AI / 料理成分表DB の結果（= 検出した1食ぶん）を基準量にする。 */
export function basisFromAnalysis(r: MealAnalysisResult): NutritionBasis | null {
  if (r.estimatedCalories == null) return null;
  return {
    name: r.dishName ?? '料理',
    base: { kcal: r.estimatedCalories, p: r.protein, f: r.fat, c: r.carbs },
    unit: 'serving',
    unitLabel: '人前',
    quantity: 1,
    origin: r.source === 'db' ? 'db' : 'ai',
  };
}

/** Open Food Facts の結果を基準量にする（serving or 100g）。 */
export function basisFromProduct(r: ProductLookupResult): NutritionBasis | null {
  if (!r.found || r.calories == null) return null;
  if (r.basis === '100g') {
    return {
      name: r.name ?? '商品',
      base: { kcal: r.calories, p: r.protein, f: r.fat, c: r.carbs },
      unit: '100g',
      unitLabel: 'g',
      quantity: 100,
      origin: 'off',
    };
  }
  return {
    name: r.name ?? '商品',
    base: { kcal: r.calories, p: r.protein, f: r.fat, c: r.carbs },
    unit: 'serving',
    unitLabel: r.servingLabel ?? '個',
    quantity: 1,
    origin: 'off',
  };
}

/** 料理DB（nutritionDb）の料理を基準量にする（1人前）。 */
export function basisFromDish(e: NutritionEntry): NutritionBasis {
  return {
    name: e.name,
    base: { kcal: e.kcal, p: e.p, f: e.f, c: e.c },
    unit: 'serving',
    unitLabel: '人前',
    quantity: 1,
    origin: 'db',
  };
}

/** 成分表の食品（100gあたり）を基準量にする。 */
export function basisFromFood(item: FoodCompositionItem): NutritionBasis {
  return {
    name: item.name,
    base: { kcal: item.kcal, p: item.p, f: item.f, c: item.c },
    unit: '100g',
    unitLabel: 'g',
    quantity: 100,
    origin: 'composition',
  };
}

/** マイ食品を基準量にする。 */
export function basisFromMyFood(food: MyFood): NutritionBasis {
  if (food.basis === '100g') {
    return {
      name: food.name,
      base: { kcal: food.calories, p: food.protein, f: food.fat, c: food.carbs },
      unit: '100g',
      unitLabel: 'g',
      quantity: 100,
      origin: 'myfood',
    };
  }
  return {
    name: food.name,
    base: { kcal: food.calories, p: food.protein, f: food.fat, c: food.carbs },
    unit: 'serving',
    unitLabel: food.servingLabel ?? '個',
    quantity: 1,
    origin: 'myfood',
  };
}
