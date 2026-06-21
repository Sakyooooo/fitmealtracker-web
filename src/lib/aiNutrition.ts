'use client';

/**
 * AI推定結果の共有キャッシュ（Supabase: ai_nutrition_cache）。
 *
 * AI(Gemini)が一度推定した料理は料理名をキーに保存し、次回以降は
 * AIを呼ばずに同じ値を返す（API費用の削減＋数値の一貫性、DBが育つ）。
 * Supabase 未設定や 009 未適用でも、AIをそのまま呼ぶ形に安全フォールバックする。
 */

import { analyzeWithGemini, estimateMealByName, estimateMealsByText, type AiMealItem } from './gemini';
import { lookupNutrition } from './nutritionDb';
import { MealAnalysisResult } from './types';
import { supabase, supabaseEnabled } from './supabase';

/** 複数推定の1料理。AiMealItem と同形。 */
export type MealComponent = AiMealItem;
export type MealBreakdown = {
  items: MealComponent[];
  total: { kcal: number; protein: number | null; fat: number | null; carbs: number | null };
};

/** マッチング用にキーを正規化（nutritionDb と同じ方針）。 */
function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s　・、,，.．。!！?？]/g, '')
    .trim();
}

/** キャッシュ未利用とみなす行（数値が無い）か。 */
function isUsable(r: MealAnalysisResult): boolean {
  return r.estimatedCalories != null && r.estimatedCalories > 0;
}

/** 料理名でキャッシュを引く。ヒットすれば MealAnalysisResult を返す。 */
async function fetchCached(name: string): Promise<MealAnalysisResult | null> {
  if (!supabaseEnabled || !supabase) return null;
  const key = normalizeKey(name);
  if (key.length < 2) return null;
  try {
    const { data, error } = await supabase
      .from('ai_nutrition_cache')
      .select('*')
      .eq('name_key', key)
      .maybeSingle();
    if (error || !data) return null;

    // 参照回数を加算（投げっぱなし）
    supabase
      .from('ai_nutrition_cache')
      .update({ hits: (Number(data.hits) || 1) + 1, updated_at: new Date().toISOString() })
      .eq('name_key', key)
      .then(() => {}, () => {});

    return {
      dishName:          (data.name as string) ?? name,
      candidates:        null,
      estimatedCalories: Number(data.kcal),
      confidence:        null,
      notes:             null,
      protein:           data.protein == null ? null : Number(data.protein),
      fat:               data.fat == null ? null : Number(data.fat),
      carbs:             data.carbs == null ? null : Number(data.carbs),
      source:            'ai',
      matchedFood:       (data.name as string) ?? null,
      servingLabel:      (data.serving as string | null) ?? null,
    };
  } catch (e) {
    console.warn('[aiNutrition] fetchCached', e);
    return null;
  }
}

/** AI推定結果を料理名キーで保存（AI由来かつ数値ありのみ）。 */
async function saveResult(name: string, r: MealAnalysisResult): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  if (!isUsable(r)) return;
  if (r.source === 'db') return; // 静的成分表一致は確定値なので保存不要
  const key = normalizeKey(name);
  if (key.length < 2) return;
  try {
    await supabase.from('ai_nutrition_cache').upsert(
      {
        name_key:   key,
        name:       r.dishName ?? name,
        kcal:       Math.round(r.estimatedCalories as number),
        protein:    r.protein ?? null,
        fat:        r.fat ?? null,
        carbs:      r.carbs ?? null,
        serving:    r.servingLabel ?? null,
        source:     'ai',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'name_key' },
    );
  } catch (e) {
    console.warn('[aiNutrition] saveResult', e);
  }
}

/**
 * 食事名テキストからの栄養推定（キャッシュ優先）。
 * ① キャッシュヒット → AIを呼ばず返す
 * ② 未ヒット → AI推定 → 結果をキャッシュへ保存
 */
export async function estimateMealByNameCached(name: string): Promise<MealAnalysisResult> {
  const cached = await fetchCached(name);
  if (cached) return cached;
  const result = await estimateMealByName(name);
  void saveResult(name, result);
  return result;
}

/**
 * 写真からの栄養推定（写真自体はキャッシュ不可だが、判定された料理名で結果を保存）。
 * 以後その料理名のテキスト推定がキャッシュヒットする。
 */
export async function analyzeMealPhotoCached(file: File): Promise<MealAnalysisResult> {
  const result = await analyzeWithGemini(file);
  if (result.dishName) void saveResult(result.dishName, result);
  return result;
}

// ── 複数料理の一括推定（テキスト） ──────────────────────────────────────────────

/** 静的成分表から1料理分を取得（確定値）。 */
function lookupStatic(name: string): MealComponent | null {
  const e = lookupNutrition(name);
  if (!e) return null;
  return { name: e.name, kcal: e.kcal, protein: e.p, fat: e.f, carbs: e.c, serving: e.serving, source: 'db' };
}

/** AIキャッシュから1料理分を取得。 */
async function readCacheComponent(name: string): Promise<MealComponent | null> {
  if (!supabaseEnabled || !supabase) return null;
  const key = normalizeKey(name);
  if (key.length < 2) return null;
  try {
    const { data, error } = await supabase
      .from('ai_nutrition_cache').select('*').eq('name_key', key).maybeSingle();
    if (error || !data) return null;
    return {
      name:    (data.name as string) ?? name,
      kcal:    Number(data.kcal),
      protein: data.protein == null ? null : Number(data.protein),
      fat:     data.fat == null ? null : Number(data.fat),
      carbs:   data.carbs == null ? null : Number(data.carbs),
      serving: (data.serving as string | null) ?? null,
      source:  'ai',
    };
  } catch { return null; }
}

/** AI由来の1料理をキャッシュへ保存。 */
async function saveComponent(c: MealComponent): Promise<void> {
  if (!supabaseEnabled || !supabase || c.source !== 'ai' || c.kcal <= 0) return;
  const key = normalizeKey(c.name);
  if (key.length < 2) return;
  try {
    await supabase.from('ai_nutrition_cache').upsert({
      name_key: key, name: c.name, kcal: Math.round(c.kcal),
      protein: c.protein ?? null, fat: c.fat ?? null, carbs: c.carbs ?? null,
      serving: c.serving ?? null, source: 'ai', updated_at: new Date().toISOString(),
    }, { onConflict: 'name_key' });
  } catch (e) { console.warn('[aiNutrition] saveComponent', e); }
}

/** 区切り文字で分割（「と」では割らない＝とんかつ等の誤分割防止）。 */
function splitDelimited(input: string): string[] {
  return input.split(/[、,，・/／＋+&＆\s　\n]+/u).map((t) => t.trim()).filter(Boolean);
}

/** 「と」「や」が語中（前後に文字あり）にあるか＝自然文の複数料理の可能性。 */
function hasConjunction(s: string): boolean {
  return /.+(と|や|＆|&|＋|\+)+.+/u.test(s);
}

export function sumComponents(items: MealComponent[]): MealBreakdown['total'] {
  const sum = (sel: (c: MealComponent) => number | null) => {
    const has = items.some((c) => sel(c) != null);
    return has ? Math.round(items.reduce((s, c) => s + (sel(c) ?? 0), 0)) : null;
  };
  return {
    kcal:    items.reduce((s, c) => s + (c.kcal || 0), 0),
    protein: sum((c) => c.protein),
    fat:     sum((c) => c.fat),
    carbs:   sum((c) => c.carbs),
  };
}

async function appendAiItems(text: string, items: MealComponent[]): Promise<void> {
  const aiItems = await estimateMealsByText(text);
  for (const ai of aiItems) {
    items.push(ai);                 // route 側で静的DB適用済み（source: 'db'|'ai'）
    if (ai.source === 'ai') void saveComponent(ai);
  }
}

/**
 * テキストを1〜複数の料理に分解して栄養を求める。
 * - 区切りあり: トークンごとに「静的DB→AIキャッシュ→（未ヒットはまとめてAI）」
 * - 区切りなし＋「と/や」: 自然文の複数料理としてAIに分解させる
 * - それ以外: 単一料理
 */
export async function estimateMealComponents(input: string): Promise<MealBreakdown> {
  const trimmed = input.trim();
  if (!trimmed) return { items: [], total: { kcal: 0, protein: null, fat: null, carbs: null } };

  const delim = splitDelimited(trimmed);
  if (delim.length < 2 && hasConjunction(trimmed)) {
    // 自然文（例:「唐揚げ定食とサラダ」）→ AIに分解させる
    const items: MealComponent[] = [];
    await appendAiItems(trimmed, items);
    return { items, total: sumComponents(items) };
  }

  const tokens = delim.length >= 2 ? Array.from(new Set(delim)) : [trimmed];
  const items: MealComponent[] = [];
  const unknown: string[] = [];
  for (const t of tokens) {
    const db = lookupStatic(t);
    if (db) { items.push(db); continue; }
    const cached = await readCacheComponent(t);
    if (cached) { items.push(cached); continue; }
    unknown.push(t);
  }
  if (unknown.length > 0) await appendAiItems(unknown.join('、'), items);

  return { items, total: sumComponents(items) };
}
