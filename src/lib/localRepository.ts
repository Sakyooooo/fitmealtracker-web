'use client';

import { deleteImage, getImageObjectUrl, saveImage } from './imageStore';
import {
  AppSettings,
  ExerciseEntry,
  GymSession,
  MealEntry,
  MyFood,
  ProductLookupResult,
  Recipe,
  WeightEntry,
} from './types';

const KEYS = {
  meals: 'fmt_meals',
  exercises: 'fmt_exercises',
  weights: 'fmt_weight_records',
  settings: 'fmt_settings',
  gymSessions: 'fmt_gym_sessions',
  myFoods: 'fmt_my_foods',
  recipes: 'fmt_recipes',
  offCache: 'fmt_off_cache',
} as const;

type NewMealEntry = Omit<MealEntry, 'id' | 'photoUri' | 'photoId'> & {
  photoFile?: File | null;
};

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error(
        'ストレージの空き容量が不足しています。不要なデータを削除してください。',
      );
    }
    throw err;
  }
}

async function withPhotoUrls(meals: MealEntry[]): Promise<MealEntry[]> {
  return Promise.all(
    meals.map(async (meal) => {
      if (!meal.photoId) return { ...meal, photoUri: undefined };
      const photoUri = await getImageObjectUrl(meal.photoId);
      return { ...meal, photoUri: photoUri ?? undefined };
    }),
  );
}

function storedMeal(meal: MealEntry): MealEntry {
  const rest = { ...meal };
  delete rest.photoUri;
  return rest;
}

export async function fetchMeals(): Promise<MealEntry[]> {
  return withPhotoUrls(load<MealEntry[]>(KEYS.meals, []));
}

/** バックアップ用: object URL を生成せず保存形のまま返す */
export function fetchMealsRaw(): MealEntry[] {
  return load<MealEntry[]>(KEYS.meals, []);
}

export async function insertMeal(entry: NewMealEntry): Promise<MealEntry> {
  const photoId = entry.photoFile ? await saveImage(entry.photoFile) : undefined;
  const mealData = { ...entry };
  delete mealData.photoFile;
  const meal: MealEntry = { ...mealData, id: generateId(), photoId };
  const meals = load<MealEntry[]>(KEYS.meals, []);
  save(KEYS.meals, [storedMeal(meal), ...meals.map(storedMeal)]);
  const [hydrated] = await withPhotoUrls([meal]);
  return hydrated;
}

export async function updateMeal(entry: MealEntry): Promise<MealEntry> {
  const meals = load<MealEntry[]>(KEYS.meals, []);
  save(KEYS.meals, meals.map((meal) => (meal.id === entry.id ? storedMeal(entry) : meal)));
  const [hydrated] = await withPhotoUrls([entry]);
  return hydrated;
}

export async function deleteMeal(id: string): Promise<void> {
  const meals = load<MealEntry[]>(KEYS.meals, []);
  const meal = meals.find((item) => item.id === id);
  save(KEYS.meals, meals.filter((item) => item.id !== id));
  if (meal?.photoId) await deleteImage(meal.photoId);
}

export async function fetchExercises(): Promise<ExerciseEntry[]> {
  return load<ExerciseEntry[]>(KEYS.exercises, []);
}

export async function insertExercise(entry: Omit<ExerciseEntry, 'id'>): Promise<ExerciseEntry> {
  const exercise: ExerciseEntry = { ...entry, id: generateId() };
  save(KEYS.exercises, [exercise, ...load<ExerciseEntry[]>(KEYS.exercises, [])]);
  return exercise;
}

export async function updateExercise(entry: ExerciseEntry): Promise<ExerciseEntry> {
  const exercises = load<ExerciseEntry[]>(KEYS.exercises, []);
  save(KEYS.exercises, exercises.map((item) => (item.id === entry.id ? entry : item)));
  return entry;
}

export async function deleteExercise(id: string): Promise<void> {
  save(
    KEYS.exercises,
    load<ExerciseEntry[]>(KEYS.exercises, []).filter((item) => item.id !== id),
  );
}

export async function fetchWeights(): Promise<WeightEntry[]> {
  return load<WeightEntry[]>(KEYS.weights, []);
}

export async function insertWeight(entry: Omit<WeightEntry, 'id'>): Promise<WeightEntry> {
  const weight: WeightEntry = { ...entry, id: generateId() };
  save(KEYS.weights, [weight, ...load<WeightEntry[]>(KEYS.weights, [])]);
  return weight;
}

export async function deleteWeight(id: string): Promise<void> {
  save(
    KEYS.weights,
    load<WeightEntry[]>(KEYS.weights, []).filter((item) => item.id !== id),
  );
}

export async function fetchActiveGymSession(): Promise<GymSession | null> {
  return load<GymSession[]>(KEYS.gymSessions, []).find((session) => session.status === 'active') ?? null;
}

export async function insertGymSession(startedAt: string): Promise<GymSession> {
  const session: GymSession = { id: generateId(), startedAt, status: 'active' };
  save(KEYS.gymSessions, [session, ...load<GymSession[]>(KEYS.gymSessions, [])]);
  return session;
}

export async function updateGymSession(session: GymSession): Promise<void> {
  const sessions = load<GymSession[]>(KEYS.gymSessions, []);
  save(
    KEYS.gymSessions,
    sessions.map((item) => (item.id === session.id ? session : item)),
  );
}

export async function deleteGymSession(id: string): Promise<void> {
  save(
    KEYS.gymSessions,
    load<GymSession[]>(KEYS.gymSessions, []).filter((item) => item.id !== id),
  );
}

export async function bulkImportMeals(entries: MealEntry[]): Promise<void> {
  const existing = load<MealEntry[]>(KEYS.meals, []);
  const existingIds = new Set(existing.map((m) => m.id));
  const toAdd = entries.filter((m) => !existingIds.has(m.id)).map(storedMeal);
  save(KEYS.meals, [...toAdd, ...existing]);
}

export async function bulkImportExercises(entries: ExerciseEntry[]): Promise<void> {
  const existing = load<ExerciseEntry[]>(KEYS.exercises, []);
  const existingIds = new Set(existing.map((e) => e.id));
  const toAdd = entries.filter((e) => !existingIds.has(e.id));
  save(KEYS.exercises, [...toAdd, ...existing]);
}

export async function bulkImportWeights(entries: WeightEntry[]): Promise<void> {
  const existing = load<WeightEntry[]>(KEYS.weights, []);
  const existingIds = new Set(existing.map((w) => w.id));
  const toAdd = entries.filter((w) => !existingIds.has(w.id));
  save(KEYS.weights, [...toAdd, ...existing]);
}

export function bulkImportMyFoods(foods: MyFood[]): void {
  const existing = fetchMyFoodsLocal();
  const existingIds = new Set(existing.map((f) => f.id));
  const toAdd = foods.filter((f) => !existingIds.has(f.id));
  save(KEYS.myFoods, [...toAdd, ...existing]);
}

/**
 * アカウント引き継ぎ用: ローカル全記録のIDを再発行して保存し直し、新IDの配列を返す。
 *
 * 匿名アカウントから既存アカウントへ切り替える際、クラウドには旧IDの行が
 * 旧uid所有のまま残っており、同じIDでのupsertはRLS（所有者のみ更新可）で失敗する。
 * そこでIDを振り直し、新uidの行として改めてINSERTできるようにする。
 * photoId（IndexedDBのキー）はレコードIDと独立しているため写真参照は壊れない。
 */
export function reissueAllRecordIds(): {
  meals: MealEntry[]; exercises: ExerciseEntry[]; weights: WeightEntry[];
  myFoods: MyFood[]; recipes: Recipe[];
} {
  const meals     = load<MealEntry[]>(KEYS.meals, []).map((m) => ({ ...m, id: generateId() }));
  const exercises = load<ExerciseEntry[]>(KEYS.exercises, []).map((e) => ({ ...e, id: generateId() }));
  const weights   = load<WeightEntry[]>(KEYS.weights, []).map((w) => ({ ...w, id: generateId() }));
  const myFoods   = fetchMyFoodsLocal().map((f) => ({ ...f, id: generateId() }));
  const recipes   = fetchRecipesLocal().map((r) => ({ ...r, id: generateId() }));
  save(KEYS.meals, meals);
  save(KEYS.exercises, exercises);
  save(KEYS.weights, weights);
  save(KEYS.myFoods, myFoods);
  save(KEYS.recipes, recipes);
  return { meals, exercises, weights, myFoods, recipes };
}

export function loadSettings(): AppSettings {
  return load<AppSettings>(KEYS.settings, {});
}

export function saveSettings(settings: AppSettings): void {
  save(KEYS.settings, settings);
}

// ── マイ食品（ローカル保存。Supabase 同期は useMyFoods 側で実施） ──────────────
export function fetchMyFoodsLocal(): MyFood[] {
  return load<MyFood[]>(KEYS.myFoods, []);
}

export function saveMyFoodsLocal(foods: MyFood[]): void {
  save(KEYS.myFoods, foods);
}

export function upsertMyFoodLocal(food: MyFood): MyFood[] {
  const foods = fetchMyFoodsLocal();
  const idx = foods.findIndex((f) => f.id === food.id);
  const next = idx >= 0
    ? foods.map((f) => (f.id === food.id ? food : f))
    : [food, ...foods];
  save(KEYS.myFoods, next);
  return next;
}

export function deleteMyFoodLocal(id: string): MyFood[] {
  const next = fetchMyFoodsLocal().filter((f) => f.id !== id);
  save(KEYS.myFoods, next);
  return next;
}

export function findMyFoodByBarcode(barcode: string): MyFood | null {
  const code = barcode.replace(/\D/g, '');
  if (!code) return null;
  return fetchMyFoodsLocal().find((f) => (f.barcode ?? '').replace(/\D/g, '') === code) ?? null;
}

export function newMyFoodId(): string {
  return generateId();
}

// ── レシピ（ローカル保存。Supabase 同期は useRecipes 側で実施） ────────────────
export function fetchRecipesLocal(): Recipe[] {
  return load<Recipe[]>(KEYS.recipes, []);
}

export function saveRecipesLocal(recipes: Recipe[]): void {
  save(KEYS.recipes, recipes);
}

export function upsertRecipeLocal(recipe: Recipe): Recipe[] {
  const recipes = fetchRecipesLocal();
  const idx = recipes.findIndex((r) => r.id === recipe.id);
  const next = idx >= 0
    ? recipes.map((r) => (r.id === recipe.id ? recipe : r))
    : [recipe, ...recipes];
  save(KEYS.recipes, next);
  return next;
}

export function deleteRecipeLocal(id: string): Recipe[] {
  const next = fetchRecipesLocal().filter((r) => r.id !== id);
  save(KEYS.recipes, next);
  return next;
}

export function newRecipeId(): string {
  return generateId();
}

// ── Open Food Facts 結果のローカルキャッシュ（高速化・オフライン耐性） ──────────
const OFF_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30日
type OffCacheEntry = { result: ProductLookupResult; cachedAt: number };

export function getCachedProduct(barcode: string): ProductLookupResult | null {
  const map = load<Record<string, OffCacheEntry>>(KEYS.offCache, {});
  const entry = map[barcode];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > OFF_CACHE_TTL_MS) return null;
  return entry.result;
}

export function setCachedProduct(barcode: string, result: ProductLookupResult): void {
  const map = load<Record<string, OffCacheEntry>>(KEYS.offCache, {});
  map[barcode] = { result, cachedAt: Date.now() };
  // 肥大化防止: 200件を超えたら古いものから間引く
  const keys = Object.keys(map);
  if (keys.length > 200) {
    keys.sort((a, b) => map[a].cachedAt - map[b].cachedAt);
    for (const k of keys.slice(0, keys.length - 200)) delete map[k];
  }
  save(KEYS.offCache, map);
}
