/**
 * 週間ジム宣言（gym_plans）のAPI。
 *
 * - 週の起点はJSTの月曜。planned_days は 0=月 … 6=日。
 * - 実績（行った日）はテーブルに持たず exercises(type='gymSession') から導出する。
 *   → 記録さえすれば宣言の達成チェックが自動で付く。
 */

import { supabase, supabaseEnabled } from './supabase';
import { ensureAuthUserId } from './identity';

const CACHE_KEY = 'fmt_gym_plan_cache'; // { weekStart, days } 自分の宣言の即時表示用

// ── JST週計算 ────────────────────────────────────────────────────────────────

function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

/** JSTの今日を YYYY-MM-DD で返す */
export function jstToday(): string {
  return jstNow().toISOString().slice(0, 10);
}

/** JSTの今日の曜日インデックス（0=月 … 6=日） */
export function jstTodayIndex(): number {
  return (jstNow().getUTCDay() + 6) % 7;
}

/** 今週の月曜日を YYYY-MM-DD で返す */
export function currentWeekStart(): string {
  const now = jstNow();
  now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  return now.toISOString().slice(0, 10);
}

/** 先週の月曜日を YYYY-MM-DD で返す（週初めの振り返りポップアップ用） */
export function previousWeekStart(): string {
  const d = new Date(`${currentWeekStart()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** week_start + index(0..6) の日付文字列 */
function dateOfIndex(weekStart: string, index: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + index);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD が週の何日目か（週外は null） */
function indexOfDate(weekStart: string, date: string): number | null {
  const diff = (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${weekStart}T00:00:00Z`).getTime()) / 86_400_000;
  return diff >= 0 && diff <= 6 ? diff : null;
}

// ── 自分の宣言 ────────────────────────────────────────────────────────────────

export function getCachedMyPlan(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { weekStart: string; days: number[] };
    return parsed.weekStart === currentWeekStart() ? parsed.days : [];
  } catch {
    return [];
  }
}

function cacheMyPlan(days: number[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ weekStart: currentWeekStart(), days }));
  } catch { /* quota */ }
}

/** 自分の今週の宣言を保存（曜日インデックス配列）。 */
export async function upsertMyPlan(days: number[]): Promise<{ error: string | null }> {
  cacheMyPlan(days);
  if (!supabaseEnabled || !supabase) return { error: null }; // ローカルのみで継続
  const userId = await ensureAuthUserId();
  const { error } = await supabase.from('gym_plans').upsert({
    user_id: userId,
    week_start: currentWeekStart(),
    planned_days: days,
    updated_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}

// ── ジム開始のフレンド通知 ────────────────────────────────────────────────────

/**
 * ジム開始をフレンドへPush通知する（notify-gym-start Edge Function）。
 * 設定 notifyGymStart=false でオフにできる（呼び出し側でチェック済み前提でも
 * 二重ガードとしてここでも見る）。失敗しても本体機能に影響させない。
 */
export async function notifyGymStart(): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  try {
    const { error } = await supabase.functions.invoke('notify-gym-start', { body: {} });
    if (error) console.warn('[gymPlans] notifyGymStart:', error.message);
  } catch (err) {
    console.warn('[gymPlans] notifyGymStart:', err);
  }
}

// ── 今週のみんなのデータ（宣言＋実績） ─────────────────────────────────────────

export type GymWeekData = {
  weekStart: string;
  /** user_id → 宣言曜日（0..6）。宣言なしはキーなし */
  plans: Record<string, number[]>;
  /** user_id → 実際に行った曜日（0..6）のSet */
  doneDays: Record<string, Set<number>>;
};

/**
 * 自分＋フレンドの指定週の宣言と実績をまとめて取得する（既定は今週）。
 * 実績は exercises(type='gymSession') の日付から導出（RLSでフレンドの公開行のみ見える）。
 */
export async function fetchGymWeekData(
  userIds: string[],
  weekStart: string = currentWeekStart(),
): Promise<GymWeekData> {
  const empty: GymWeekData = { weekStart, plans: {}, doneDays: {} };
  if (!supabaseEnabled || !supabase || userIds.length === 0) return empty;

  const weekEnd = dateOfIndex(weekStart, 6);
  const [plansRes, doneRes] = await Promise.all([
    supabase
      .from('gym_plans')
      .select('user_id, planned_days')
      .eq('week_start', weekStart)
      .in('user_id', userIds),
    supabase
      .from('exercises')
      .select('user_id, date')
      .in('user_id', userIds)
      .eq('type', 'gymSession')
      .gte('date', weekStart)
      .lte('date', weekEnd),
  ]);

  if (plansRes.error) console.error('[gymPlans] plans:', plansRes.error.message);
  if (doneRes.error) console.error('[gymPlans] done:', doneRes.error.message);

  const plans: Record<string, number[]> = {};
  for (const row of plansRes.data ?? []) {
    plans[row.user_id as string] = ((row.planned_days as number[] | null) ?? []).map(Number);
  }

  const doneDays: Record<string, Set<number>> = {};
  for (const row of doneRes.data ?? []) {
    const idx = indexOfDate(weekStart, row.date as string);
    if (idx === null) continue;
    const uid = row.user_id as string;
    (doneDays[uid] ??= new Set()).add(idx);
  }

  return { weekStart, plans, doneDays };
}

// ── 週の初めの振り返りポップアップ（表示済み管理） ───────────────────────────

const REVIEW_SHOWN_KEY = 'fmt_weekly_gym_review_shown_week';

/** 直近で振り返りポップアップを表示した週の開始日（未表示なら null）。 */
export function getWeeklyReviewShownWeek(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REVIEW_SHOWN_KEY);
  } catch {
    return null;
  }
}

export function setWeeklyReviewShownWeek(weekStart: string): void {
  try {
    localStorage.setItem(REVIEW_SHOWN_KEY, weekStart);
  } catch { /* quota */ }
}
