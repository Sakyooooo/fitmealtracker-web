import { NextResponse } from 'next/server';
import { GEMINI_ENDPOINT, GEMINI_FALLBACK, extractJson } from '@/lib/gemini';
import { MealAnalysisResult } from '@/lib/types';

const PROMPT = `
この料理の画像を分析してください。
以下のJSONのみを返してください（他のテキスト・マークダウン不要）:
{
  "dishName": "料理名（日本語で具体的に。不明ならnull）",
  "estimatedCalories": 数値（cal、不明ならnull）,
  "confidence": 0.0〜1.0,
  "protein": 数値（タンパク質 g、不明ならnull）,
  "fat": 数値（脂質 g、不明ならnull）,
  "carbs": 数値（炭水化物 g、不明ならnull）,
  "notes": "補足説明（不要ならnull）"
}
`.trim();

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

function normalizeResult(value: Partial<MealAnalysisResult>): MealAnalysisResult {
  return {
    dishName: typeof value.dishName === 'string' ? value.dishName : null,
    estimatedCalories:
      typeof value.estimatedCalories === 'number' ? value.estimatedCalories : null,
    confidence: typeof value.confidence === 'number' ? value.confidence : null,
    notes: typeof value.notes === 'string' ? value.notes : null,
    protein: typeof value.protein === 'number' ? value.protein : null,
    fat: typeof value.fat === 'number' ? value.fat : null,
    carbs: typeof value.carbs === 'number' ? value.carbs : null,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(GEMINI_FALLBACK);
  }

  const formData = await request.formData();
  const image = formData.get('image');

  if (!(image instanceof File) || !image.type.startsWith('image/')) {
    return NextResponse.json({ error: 'image file is required' }, { status: 400 });
  }

  if (image.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: 'image is too large' }, { status: 413 });
  }

  const base64 = Buffer.from(await image.arrayBuffer()).toString('base64');
  const body = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: image.type, data: base64 } },
      ],
    }],
  };

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json(GEMINI_FALLBACK);
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return NextResponse.json(normalizeResult(extractJson(text) as MealAnalysisResult));
  } catch (error) {
    console.error('[gemini route]', error);
    return NextResponse.json(GEMINI_FALLBACK);
  }
}
