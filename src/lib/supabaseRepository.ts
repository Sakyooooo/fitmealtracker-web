/**
 * Supabase を使った meals / exercises / reactions の CRUD。
 * supabaseEnabled が false のときは何もしない（既存の localStorage 設計を壊さない）。
 */

import { supabase, supabaseEnabled } from './supabase';
import { MealEntry, ExerciseEntry, MyFood, ReactionEmoji, TimelineItem, Reaction } from './types';
import { ensureAuthUserId } from './identity';

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
    const { data: mealsData } = await supabase
      .from('meals')
      .select('id, user_id, name, calories, category, date, note, protein, fat, carbs, photo_url, created_at, users!meals_user_id_fkey(display_name, friend_code, avatar_url)')
      .in('user_id', friendIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    // 運動
    const { data: exercisesData } = await supabase
      .from('exercises')
      .select('id, user_id, name, calories_burned, duration_minutes, date, note, type, created_at, users!exercises_user_id_fkey(display_name, friend_code, avatar_url)')
      .in('user_id', friendIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    // 取得した全 record_id のリアクションを一括取得
    const allIds = [
      ...(mealsData ?? []).map((m) => m.id as string),
      ...(exercisesData ?? []).map((e) => e.id as string),
    ];

    const { data: reactionsData } = allIds.length > 0
      ? await supabase.from('reactions').select('*').in('record_id', allIds)
      : { data: [] };

    const reactions = (reactionsData ?? []) as Reaction[];

    // helpers
    const reactionsFor = (id: string) => reactions.filter((r) => r.record_id === id);
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

export async function upsertReaction(
  fromUserId: string,
  recordId: string,
  recordType: 'meal' | 'exercise',
  emoji: ReactionEmoji,
): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;
  const { error } = await supabase.from('reactions').upsert({
    from_user_id: fromUserId,
    record_id:    recordId,
    record_type:  recordType,
    emoji,
  });
  if (error) { console.error('[upsertReaction]', error.message); return false; }
  return true;
}

export async function deleteReaction(
  fromUserId: string,
  recordId: string,
): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;
  const { error } = await supabase.from('reactions')
    .delete()
    .eq('from_user_id', fromUserId)
    .eq('record_id', recordId);
  if (error) { console.error('[deleteReaction]', error.message); return false; }
  return true;
}
