import { MealAnalysisResult } from './types';

export const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

export const GEMINI_FALLBACK: MealAnalysisResult = {
  dishName: '料理名を入力してください',
  estimatedCalories: 500,
  confidence: 0,
  notes: 'AI推定に失敗しました。値を手動で修正してください。',
  protein: null,
  fat: null,
  carbs: null,
};

export function extractJson(text: string): unknown {
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) return JSON.parse(blockMatch[1].trim());
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return JSON.parse(objectMatch[0]);
  throw new Error('JSON not found in response');
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
