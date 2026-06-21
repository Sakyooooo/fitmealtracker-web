import { MealAnalysisResult } from './types';

export const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

// estimatedCalories を null にして誤情報（500kcal）を与えない
export const GEMINI_FALLBACK: MealAnalysisResult = {
  dishName: null,
  candidates: null,
  estimatedCalories: null,
  confidence: 0,
  notes: 'AI推定に失敗しました。値を手動で入力してください。',
  protein: null,
  fat: null,
  carbs: null,
};

/** Gemini の応答テキストから JSON オブジェクトを安全に抽出する */
export function extractJson(text: string): unknown {
  try {
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (blockMatch) return JSON.parse(blockMatch[1].trim());
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
  } catch (err) {
    console.warn('[extractJson] JSON parse failed:', err);
  }
  return null;
}

export async function analyzeWithGemini(file: File): Promise<MealAnalysisResult> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/analyze-meal', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) return GEMINI_FALLBACK;
    return (await res.json()) as MealAnalysisResult;
  } catch (e) {
    console.error('[gemini]', e);
    return GEMINI_FALLBACK;
  }
}

/** 複数推定（mode=multi）で返る1料理分。 */
export type AiMealItem = {
  name: string;
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  serving: string | null;
  source: 'db' | 'ai';
};

/** 食事メモを複数料理に分解して栄養を推定（写真なし）。失敗時は空配列。 */
export async function estimateMealsByText(text: string): Promise<AiMealItem[]> {
  const formData = new FormData();
  formData.append('name', text);
  formData.append('mode', 'multi');
  try {
    const res = await fetch('/api/analyze-meal', { method: 'POST', body: formData });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: AiMealItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    console.error('[gemini multi]', e);
    return [];
  }
}

/** 食事名テキストだけから Gemini にカロリー/PFCを推定させる（写真なし）。 */
export async function estimateMealByName(name: string): Promise<MealAnalysisResult> {
  const formData = new FormData();
  formData.append('name', name);

  try {
    const res = await fetch('/api/analyze-meal', { method: 'POST', body: formData });
    if (!res.ok) return GEMINI_FALLBACK;
    return (await res.json()) as MealAnalysisResult;
  } catch (e) {
    console.error('[gemini name]', e);
    return GEMINI_FALLBACK;
  }
}
