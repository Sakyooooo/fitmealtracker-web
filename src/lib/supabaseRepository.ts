/**
 * Supabase を使った meals / exercises / reactions の CRUD。
 * supabaseEnabled が false のときは何もしない（既存の localStorage 設計を壊さない）。
 */

import { supabase, supabaseEnabled } from './supabase';
import { MealEntry, ExerciseEntry, MyFood, ReactionEmoji, Recipe, RecipeIngredient, TimelineItem, Reaction, Comment, WeightEntry, GymSession, WorkoutSet } from './types';
import { ensureAuthUserId } from './identity';
import { bulkImportMeals, bulkImportExercises, bulkImportWeights, bulkImportMyFoods } from './localRepository';

// ── helpers ───────────────────────────────────────────────────────────────────

function toSupaMeal(m: MealEntry, userId: string) {
  return {
    id:         m.id,
    user_id:    userId,
    name:       m.name,
    calories:   m.calories,
    time:       m.time,
    category:   m.category,
    date:       m.date,
    note:       m.note ?? null,
    protein:    m.protein ?? null,
    fat:        m.fat ?? null,
    carbs:      m.carbs ?? null,
    photo_url:  m.photoUrl ?? null,
    is_public:  true,
  };
}

/**
 * 食事写真を Storage(meal-photos) にアップロードして公開 URL を返す。
 * バケット未作成や失敗時は null（タイムラインはプレースホルダ表示にフォールバック）。
 */
export async function sbUploadMealPhoto(mealId: string, file: File): Promise<string | null> {
  if (!supabaseEnabled || !supabase) return null;
  const ext = ((file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'));
  const path = `${mealId}.${ext}`;
  const { error } = await supabase.storage.from('meal-photos').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });
  if (error) { console.error('[sbUploadMealPhoto]', error.message); return null; }
  const { data } = supabase.storage.from('meal-photos').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

function toSupaExercise(e: ExerciseEntry, userId: string) {
  return {
    id:               e.id,
    user_id:          userId,
    name:             e.name,
    duration_minutes: e.durationMinutes,
    calories_burned:  e.caloriesBurned,
    date:             e.date,
    note:             e.note ?? null,
    type:             e.type,
    is_public:        true,
  };
}

// ── Meals ─────────────────────────────────────────────────────────────────────

export async function sbUpsertMeal(meal: MealEntry): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('meals').upsert(toSupaMeal(meal, userId));
  if (error) console.error('[supabaseRepository] upsertMeal:', error.message);
}

export async function sbDeleteMeal(id: string): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) console.error('[supabaseRepository] deleteMeal:', error.message);
}

export async function sbFetchMyMeals(): Promise<MealEntry[] | null> {
  if (!supabaseEnabled || !supabase) return null;
  const userId = await ensureAuthUserId();
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) { console.error('[supabaseRepository] fetchMyMeals:', error.message); return null; }
  return (data ?? []).map((r) => ({
    id:       r.id as string,
    name:     r.name as string,
    calories: r.calories as number,
    time:     r.time as string,
    category: r.category as MealEntry['category'],
    date:     r.date as string,
    note:     r.note as string | undefined,
    protein:  r.protein as number | undefined,
    fat:      r.fat as number | undefined,
    carbs:    r.carbs as number | undefined,
  }));
}

// ── Exercises ─────────────────────────────────────────────────────────────────

export async function sbUpsertExercise(exercise: ExerciseEntry): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('exercises').upsert(toSupaExercise(exercise, userId));
  if (error) console.error('[supabaseRepository] upsertExercise:', error.message);
}

export async function sbDeleteExercise(id: string): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) console.error('[supabaseRepository] deleteExercise:', error.message);
}

export async function sbFetchMyExercises(): Promise<ExerciseEntry[] | null> {
  if (!supabaseEnabled || !supabase) return null;
  const userId = await ensureAuthUserId();
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) { console.error('[supabaseRepository] fetchMyExercises:', error.message); return null; }
  return (data ?? []).map((r) => ({
    id:              r.id as string,
    name:            r.name as string,
    durationMinutes: r.duration_minutes as number,
    caloriesBurned:  r.calories_burned as number,
    date:            r.date as string,
    note:            (r.note as string | null) ?? '',
    type:            (r.type as ExerciseEntry['type']) ?? 'normal',
  }));
}

// ── My Foods（マイ食品の端末間同期） ─────────────────────────────────────────

// 006_my_foods.sql 未適用の環境ではテーブルが無い。最初の失敗で同期を停止し、
// ローカル保存のみで動作させる（コンソールのエラー連発を防ぐ）。
let myFoodsUnavailable = false;
function noteMyFoodsError(msg: string): void {
  if (msg.includes('Could not find the table') || msg.includes('my_foods')) {
    if (!myFoodsUnavailable) {
      console.warn('[my_foods] テーブル未作成のため同期を無効化します（supabase/migrations/006_my_foods.sql を実行すると有効化）');
    }
    myFoodsUnavailable = true;
  } else {
    console.error('[supabaseRepository] my_foods:', msg);
  }
}

function toSupaMyFood(f: MyFood, userId: string) {
  return {
    id:            f.id,
    user_id:       userId,
    name:          f.name,
    barcode:       f.barcode ?? null,
    basis:         f.basis,
    serving_label: f.servingLabel ?? null,
    calories:      f.calories,
    protein:       f.protein ?? null,
    fat:           f.fat ?? null,
    carbs:         f.carbs ?? null,
    created_at:    f.createdAt,
    updated_at:    f.updatedAt,
  };
}

function fromSupaMyFood(r: Record<string, unknown>): MyFood {
  return {
    id:           r.id as string,
    name:         r.name as string,
    barcode:      (r.barcode as string | null) ?? null,
    basis:        (r.basis as MyFood['basis']) ?? 'serving',
    servingLabel: (r.serving_label as string | null) ?? null,
    calories:     Number(r.calories),
    protein:      r.protein == null ? null : Number(r.protein),
    fat:          r.fat == null ? null : Number(r.fat),
    carbs:        r.carbs == null ? null : Number(r.carbs),
    createdAt:    (r.created_at as string) ?? new Date().toISOString(),
    updatedAt:    (r.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function sbUpsertMyFood(food: MyFood): Promise<void> {
  if (!supabaseEnabled || !supabase || myFoodsUnavailable) return;
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('my_foods').upsert(toSupaMyFood(food, userId));
  if (error) noteMyFoodsError(error.message);
}

export async function sbDeleteMyFood(id: string): Promise<void> {
  if (!supabaseEnabled || !supabase || myFoodsUnavailable) return;
  const { error } = await supabase.from('my_foods').delete().eq('id', id);
  if (error) noteMyFoodsError(error.message);
}

export async function sbFetchMyFoods(): Promise<MyFood[] | null> {
  if (!supabaseEnabled || !supabase || myFoodsUnavailable) return null;
  const userId = await ensureAuthUserId();
  const { data, error } = await supabase
    .from('my_foods')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) { noteMyFoodsError(error.message); return null; }
  return (data ?? []).map((r) => fromSupaMyFood(r as Record<string, unknown>));
}

// ── Recipes（レシピの端末間同期） ─────────────────────────────────────────────

// 010_recipes.sql 未適用の環境ではテーブルが無い。最初の失敗で同期を停止し、
// ローカル保存のみで動作させる（コンソールのエラー連発を防ぐ）。
let recipesUnavailable = false;
function noteRecipesError(msg: string): void {
  if (msg.includes('Could not find the table') || msg.includes('recipes')) {
    if (!recipesUnavailable) {
      console.warn('[recipes] テーブル未作成のため同期を無効化します（supabase/migrations/010_recipes.sql を実行すると有効化）');
    }
    recipesUnavailable = true;
  } else {
    console.error('[supabaseRepository] recipes:', msg);
  }
}

function toSupaRecipe(r: Recipe, userId: string) {
  return {
    id:          r.id,
    user_id:     userId,
    name:        r.name,
    servings:    r.servings,
    ingredients: r.ingredients,
    steps:       r.steps,
    calories:    r.calories ?? null,
    protein:     r.protein ?? null,
    fat:         r.fat ?? null,
    carbs:       r.carbs ?? null,
    source_type: r.sourceType,
    source_url:  r.sourceUrl ?? null,
    note:        r.note ?? null,
    created_at:  r.createdAt,
    updated_at:  r.updatedAt,
  };
}

function fromSupaRecipe(r: Record<string, unknown>): Recipe {
  return {
    id:          r.id as string,
    name:        r.name as string,
    servings:    Number(r.servings) || 1,
    ingredients: Array.isArray(r.ingredients) ? (r.ingredients as RecipeIngredient[]) : [],
    steps:       Array.isArray(r.steps) ? (r.steps as string[]) : [],
    calories:    r.calories == null ? null : Number(r.calories),
    protein:     r.protein == null ? null : Number(r.protein),
    fat:         r.fat == null ? null : Number(r.fat),
    carbs:       r.carbs == null ? null : Number(r.carbs),
    sourceType:  (r.source_type as Recipe['sourceType']) ?? 'manual',
    sourceUrl:   (r.source_url as string | null) ?? null,
    note:        (r.note as string | null) ?? null,
    createdAt:   (r.created_at as string) ?? new Date().toISOString(),
    updatedAt:   (r.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function sbUpsertRecipe(recipe: Recipe): Promise<void> {
  if (!supabaseEnabled || !supabase || recipesUnavailable) return;
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('recipes').upsert(toSupaRecipe(recipe, userId));
  if (error) noteRecipesError(error.message);
}

export async function sbDeleteRecipe(id: string): Promise<void> {
  if (!supabaseEnabled || !supabase || recipesUnavailable) return;
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) noteRecipesError(error.message);
}

export async function sbFetchRecipes(): Promise<Recipe[] | null> {
  if (!supabaseEnabled || !supabase || recipesUnavailable) return null;
  const userId = await ensureAuthUserId();
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) { noteRecipesError(error.message); return null; }
  return (data ?? []).map((r) => fromSupaRecipe(r as Record<string, unknown>));
}

// ── クラウド復元（端末をまたいで自分の記録をローカルへ取り込む） ────────────────

/**
 * Supabase 上の自分の記録（食事/運動/体重/マイ食品）をローカルへ取り込む。
 * 連携アカウントへサインインし直した後の「クラウドから復元」用。
 * 重複（同じ id）は bulkImport 側で自動スキップ。取り込み件数を返す。
 * ※ 食事写真は端末ローカル(IndexedDB)管理のため、写真自体は復元されない。
 */
export async function syncDownAllFromSupabase(): Promise<{
  meals: number; exercises: number; weights: number; myFoods: number;
}> {
  const [meals, exercises, weights, myFoods] = await Promise.all([
    sbFetchMyMeals(),
    sbFetchMyExercises(),
    sbFetchMyWeights(),
    sbFetchMyFoods(),
  ]);
  if (meals)     await bulkImportMeals(meals);
  if (exercises) await bulkImportExercises(exercises);
  if (weights)   await bulkImportWeights(weights);
  if (myFoods)   bulkImportMyFoods(myFoods);
  return {
    meals:     meals?.length ?? 0,
    exercises: exercises?.length ?? 0,
    weights:   weights?.length ?? 0,
    myFoods:   myFoods?.length ?? 0,
  };
}

// ── Weights（体重の端末間同期。本人専用・フレンド非公開） ──────────────────────

// 007_weights_gym_sessions.sql 未適用の環境ではテーブルが無い。
// 最初の失敗で同期を停止し、ローカル保存のみで動作させる（エラー連発を防ぐ）。
let weightsUnavailable = false;
let gymSessionsUnavailable = false;
function noteSyncTableMissing(label: string, msg: string): boolean {
  // テーブル未作成（PostgREST: PGRST205 / "Could not find the table"）か判定
  const missing = msg.includes('Could not find the table') || msg.includes('does not exist');
  if (missing) {
    console.warn(`[${label}] テーブル未作成のため同期を無効化します（supabase/migrations/007_weights_gym_sessions.sql を実行すると有効化）`);
  } else {
    console.error(`[supabaseRepository] ${label}:`, msg);
  }
  return missing;
}

function toSupaWeight(w: WeightEntry, userId: string) {
  return {
    id:        w.id,
    user_id:   userId,
    date:      w.date,
    weight_kg: w.weightKg,
    note:      w.note ?? null,
  };
}

function fromSupaWeight(r: Record<string, unknown>): WeightEntry {
  return {
    id:       r.id as string,
    date:     r.date as string,
    weightKg: Number(r.weight_kg),
    note:     (r.note as string | null) ?? undefined,
  };
}

export async function sbUpsertWeight(weight: WeightEntry): Promise<void> {
  if (!supabaseEnabled || !supabase || weightsUnavailable) return;
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('weights').upsert(toSupaWeight(weight, userId));
  if (error) weightsUnavailable = noteSyncTableMissing('weights', error.message);
}

export async function sbDeleteWeight(id: string): Promise<void> {
  if (!supabaseEnabled || !supabase || weightsUnavailable) return;
  const { error } = await supabase.from('weights').delete().eq('id', id);
  if (error) weightsUnavailable = noteSyncTableMissing('weights', error.message);
}

export async function sbFetchMyWeights(): Promise<WeightEntry[] | null> {
  if (!supabaseEnabled || !supabase || weightsUnavailable) return null;
  const userId = await ensureAuthUserId();
  const { data, error } = await supabase
    .from('weights')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) { weightsUnavailable = noteSyncTableMissing('weights', error.message); return null; }
  return (data ?? []).map((r) => fromSupaWeight(r as Record<string, unknown>));
}

// ── Gym Sessions（ジムセッションの端末間同期。本人専用・フレンド非公開） ─────────

function toSupaGymSession(s: GymSession, userId: string) {
  return {
    id:                        s.id,
    user_id:                   userId,
    started_at:                s.startedAt,
    ended_at:                  s.endedAt ?? null,
    duration_sec:              s.durationSec ?? null,
    estimated_calories_burned: s.estimatedCaloriesBurned ?? null,
    memo:                      s.memo ?? null,
    workout_sets:              s.workoutSets ?? null,
    status:                    s.status,
  };
}

function fromSupaGymSession(r: Record<string, unknown>): GymSession {
  return {
    id:                      r.id as string,
    startedAt:               r.started_at as string,
    endedAt:                 (r.ended_at as string | null) ?? undefined,
    durationSec:             r.duration_sec == null ? undefined : Number(r.duration_sec),
    estimatedCaloriesBurned: r.estimated_calories_burned == null ? undefined : Number(r.estimated_calories_burned),
    memo:                    (r.memo as string | null) ?? undefined,
    workoutSets:             (r.workout_sets as WorkoutSet[] | null) ?? undefined,
    status:                  r.status as GymSession['status'],
  };
}

export async function sbUpsertGymSession(session: GymSession): Promise<void> {
  if (!supabaseEnabled || !supabase || gymSessionsUnavailable) return;
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('gym_sessions').upsert(toSupaGymSession(session, userId));
  if (error) gymSessionsUnavailable = noteSyncTableMissing('gym_sessions', error.message);
}

export async function sbDeleteGymSession(id: string): Promise<void> {
  if (!supabaseEnabled || !supabase || gymSessionsUnavailable) return;
  const { error } = await supabase.from('gym_sessions').delete().eq('id', id);
  if (error) gymSessionsUnavailable = noteSyncTableMissing('gym_sessions', error.message);
}

/** 進行中（active）のジムセッションを1件取得。別端末で開始したセッションの引き継ぎ用。 */
export async function sbFetchActiveGymSession(): Promise<GymSession | null> {
  if (!supabaseEnabled || !supabase || gymSessionsUnavailable) return null;
  const userId = await ensureAuthUserId();
  const { data, error } = await supabase
    .from('gym_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { gymSessionsUnavailable = noteSyncTableMissing('gym_sessions', error.message); return null; }
  return data ? fromSupaGymSession(data as Record<string, unknown>) : null;
}

// ── Migration: localStorage → Supabase ───────────────────────────────────────

export async function migrateLocalToSupabase(
  meals: MealEntry[],
  exercises: ExerciseEntry[],
  onProgress?: (pct: number) => void,
): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;
  const userId = await ensureAuthUserId();
  const total = meals.length + exercises.length;
  if (total === 0) return true;

  let done = 0;
  const tick = () => { done++; onProgress?.(Math.round((done / total) * 100)); };

  try {
    // meals を 50 件ずつバッチ upsert
    for (let i = 0; i < meals.length; i += 50) {
      const batch = meals.slice(i, i + 50).map((m) => toSupaMeal(m, userId));
      const { error } = await supabase.from('meals').upsert(batch);
      if (error) { console.error('[migration] meals batch:', error.message); return false; }
      batch.forEach(() => tick());
    }
    // exercises
    for (let i = 0; i < exercises.length; i += 50) {
      const batch = exercises.slice(i, i + 50).map((e) => toSupaExercise(e, userId));
      const { error } = await supabase.from('exercises').upsert(batch);
      if (error) { console.error('[migration] exercises batch:', error.message); return false; }
      batch.forEach(() => tick());
    }
    return true;
  } catch (err) {
    console.error('[migration] unexpected:', err);
    return false;
  }
}

// ── Timeline ─────────────────────────────────────────────────────────────────

/**
 * フレンド（accepted）の公開食事・運動を新着順で取得し、
 * 自分のリアクション情報を付与して返す。
 */
export async function fetchTimeline(
  friendIds: string[],
  myUserId: string,
  limit = 30,
): Promise<TimelineItem[]> {
  if (!supabaseEnabled || !supabase || friendIds.length === 0) return [];

  try {
    // 食事
    const { data: mealsData, error: mealsError } = await supabase
      .from('meals')
      .select('id, user_id, name, calories, category, date, note, protein, fat, carbs, photo_url, created_at, users(display_name, friend_code, avatar_url)')
      .in('user_id', friendIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (mealsError) console.error('[fetchTimeline] meals:', mealsError.message);

    // 運動
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('exercises')
      .select('id, user_id, name, calories_burned, duration_minutes, date, note, type, created_at, users(display_name, friend_code, avatar_url)')
      .in('user_id', friendIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (exercisesError) console.error('[fetchTimeline] exercises:', exercisesError.message);

    // 取得した全 record_id のリアクションを一括取得
    const allIds = [
      ...(mealsData ?? []).map((m) => m.id as string),
      ...(exercisesData ?? []).map((e) => e.id as string),
    ];

    const { data: reactionsData } = allIds.length > 0
      ? await supabase.from('reactions').select('*').in('record_id', allIds)
      : { data: [] };

    const reactions = (reactionsData ?? []) as Reaction[];

    // コメント（投稿者の表示名/アバターを JOIN）。008 未適用ならエラーを無視して空に。
    const { data: commentsData, error: commentsError } = allIds.length > 0
      ? await supabase
          .from('comments')
          .select('id, from_user_id, record_id, record_type, body, created_at, users(display_name, avatar_url)')
          .in('record_id', allIds)
          .order('created_at', { ascending: true })
      : { data: [], error: null };
    if (commentsError) console.warn('[fetchTimeline] comments:', commentsError.message);

    const comments: Comment[] = (commentsData ?? []).map((c) => {
      const u = (c.users as unknown) as { display_name: string | null; avatar_url: string | null } | null;
      return {
        id:           c.id as string,
        from_user_id: c.from_user_id as string,
        record_id:    c.record_id as string,
        record_type:  c.record_type as 'meal' | 'exercise',
        body:         c.body as string,
        created_at:   c.created_at as string,
        display_name: u?.display_name ?? null,
        avatar_url:   u?.avatar_url ?? null,
      };
    });

    // helpers
    const reactionsFor = (id: string) => reactions.filter((r) => r.record_id === id);
    const commentsFor = (id: string) => comments.filter((c) => c.record_id === id);
    const myReaction = (id: string): ReactionEmoji | null =>
      (reactions.find((r) => r.record_id === id && r.from_user_id === myUserId)?.emoji as ReactionEmoji) ?? null;

    // 食事アイテム
    const mealItems: TimelineItem[] = (mealsData ?? []).map((m) => {
      const user = (m.users as unknown) as { display_name: string | null; friend_code: string; avatar_url: string | null } | null;
      return {
        id:           m.id as string,
        type:         'meal',
        user_id:      m.user_id as string,
        display_name: user?.display_name ?? null,
        friend_code:  user?.friend_code ?? '',
        avatarUrl:    user?.avatar_url ?? null,
        name:         m.name as string,
        calories:     m.calories as number,
        date:         m.date as string,
        category:     m.category as string,
        protein:      m.protein as number | null,
        fat:          m.fat as number | null,
        carbs:        m.carbs as number | null,
        photoUrl:     m.photo_url as string | null,
        note:         m.note as string | null,
        created_at:   m.created_at as string,
        reactions:    reactionsFor(m.id as string),
        my_reaction:  myReaction(m.id as string),
        comments:     commentsFor(m.id as string),
      };
    });

    // 運動アイテム
    const exerciseItems: TimelineItem[] = (exercisesData ?? []).map((e) => {
      const user = (e.users as unknown) as { display_name: string | null; friend_code: string; avatar_url: string | null } | null;
      return {
        id:               e.id as string,
        type:             'exercise',
        user_id:          e.user_id as string,
        display_name:     user?.display_name ?? null,
        friend_code:      user?.friend_code ?? '',
        avatarUrl:        user?.avatar_url ?? null,
        name:             e.name as string,
        calories:         e.calories_burned as number,
        date:             e.date as string,
        duration_minutes: e.duration_minutes as number,
        exercise_type:    e.type as string,
        note:             e.note as string | null,
        created_at:       e.created_at as string,
        reactions:        reactionsFor(e.id as string),
        my_reaction:      myReaction(e.id as string),
        comments:         commentsFor(e.id as string),
      };
    });

    // 新着順にマージ
    return [...mealItems, ...exerciseItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ).slice(0, limit);
  } catch (err) {
    console.error('[fetchTimeline]', err);
    return [];
  }
}

// ── Reactions ─────────────────────────────────────────────────────────────────

/**
 * 投稿(meal/exercise)へのリアクションを追加/変更。
 * from_user_id は auth.uid() を使用（RLS準拠）。1ユーザー1投稿1件のため、
 * (from_user_id, record_id) の UNIQUE で onConflict 更新する（絵文字の付け替えに対応）。
 */
export async function upsertReaction(
  recordId: string,
  recordType: 'meal' | 'exercise',
  emoji: ReactionEmoji,
): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('reactions').upsert(
    {
      from_user_id: userId,
      record_id:    recordId,
      record_type:  recordType,
      emoji,
    },
    { onConflict: 'from_user_id,record_id' },
  );
  if (error) { console.error('[upsertReaction]', error.message); return false; }
  return true;
}

export async function deleteReaction(recordId: string): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('reactions')
    .delete()
    .eq('from_user_id', userId)
    .eq('record_id', recordId);
  if (error) { console.error('[deleteReaction]', error.message); return false; }
  return true;
}

// ── Comments ────────────────────────────────────────────────────────────────────

/**
 * 投稿(meal/exercise)へコメントを追加。from_user_id は auth.uid() を使用（RLS準拠）。
 * 成功時は作成された Comment（投稿者表示名/アバター付き）を返す。
 */
export async function addComment(
  recordId: string,
  recordType: 'meal' | 'exercise',
  body: string,
): Promise<Comment | null> {
  if (!supabaseEnabled || !supabase) return null;
  const text = body.trim();
  if (!text) return null;
  const userId = await ensureAuthUserId();
  const { data, error } = await supabase
    .from('comments')
    .insert({ from_user_id: userId, record_id: recordId, record_type: recordType, body: text })
    .select('id, from_user_id, record_id, record_type, body, created_at, users(display_name, avatar_url)')
    .single();
  if (error) { console.error('[addComment]', error.message); return null; }
  const u = (data.users as unknown) as { display_name: string | null; avatar_url: string | null } | null;
  return {
    id:           data.id as string,
    from_user_id: data.from_user_id as string,
    record_id:    data.record_id as string,
    record_type:  data.record_type as 'meal' | 'exercise',
    body:         data.body as string,
    created_at:   data.created_at as string,
    display_name: u?.display_name ?? null,
    avatar_url:   u?.avatar_url ?? null,
  };
}

export async function deleteComment(commentId: string): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) { console.error('[deleteComment]', error.message); return false; }
  return true;
}
