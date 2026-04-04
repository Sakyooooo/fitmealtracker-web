import { MealAnalysisResult } from './types';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

const PROMPT = `
この料理の画像を分析してください。
以下のJSONのみを返してください（他のテキスト・マークダウン不要）:
{
  "dishName": "料理名（日本語で具体的に。不明なら null）",
  "estimatedCalories": 数値（kcal、不明なら null）,
  "confidence": 0.0〜1.0,
  "protein": 数値（タンパク質 g、不明なら null）,
  "fat": 数値（脂質 g、不明なら null）,
  "carbs": 数値（炭水化物 g、不明なら null）,
  "notes": "補足説明（不要なら null）"
}
`.trim();

export const GEMINI_FALLBACK: MealAnalysisResult = {
  dishName: '料理名を入力してください',
  estimatedCalories: 500,
  confidence: 0,
  notes: 'AI推定に失敗しました。値を手動で修正してください。',
  protein: null,
  fat: null,
  carbs: null,
};

function extractJson(text: string): unknown {
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) return JSON.parse(blockMatch[1].trim());
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return JSON.parse(objectMatch[0]);
  throw new Error('JSON not found in response');
}

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeWithGemini(file: File): Promise<MealAnalysisResult> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return GEMINI_FALLBACK;

  const { base64, mimeType } = await fileToBase64(file);

  const body = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
  };

  async function callOnce(): Promise<{ status: number; result?: MealAnalysisResult }> {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) return { status: 429 };
    if (!res.ok) return { status: res.status };
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = extractJson(text) as MealAnalysisResult;
    return { status: 200, result: parsed };
  }

  try {
    const first = await callOnce();
    if (first.status === 200 && first.result) return first.result;
    if (first.status === 429) {
      await new Promise((r) => setTimeout(r, 30000));
      const retry = await callOnce();
      if (retry.status === 200 && retry.result) return retry.result;
    }
  } catch (e) {
    console.error('[gemini]', e);
  }
  return GEMINI_FALLBACK;
}
