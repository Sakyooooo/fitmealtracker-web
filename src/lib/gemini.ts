import { MealAnalysisResult } from './types';

export const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
