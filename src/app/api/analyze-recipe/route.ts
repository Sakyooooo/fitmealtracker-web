import { NextResponse } from 'next/server';
import { extractJson } from '@/lib/gemini';
import { callGeminiWithFallback } from '@/lib/geminiServer';
import { extractYouTubeVideoId, normalizeRecipeAnalysis } from '@/lib/recipe';
import { isAllowedRequestOrigin } from '@/lib/apiOrigin';

// ── Security: feature flag ────────────────────────────────────────────────────
// analyze-meal と同じフラグで一括無効化できるようにする。
const ANALYSIS_ENABLED = process.env.MEAL_ANALYSIS_ENABLED !== 'false';

// ── Security: rate limiting ───────────────────────────────────────────────────
// 動画解析は画像より高コストのため analyze-meal より厳しめ:
//   per-IP: 3回/分、グローバル: 10回/分（環境変数で調整可）
const RATE_LIMIT_MAX = 3;
const RATE_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const GLOBAL_LIMIT_MAX = Number(process.env.RECIPE_ANALYSIS_GLOBAL_MAX ?? 10);
let globalWindow = { count: 0, resetAt: 0 };

function checkGlobalLimit(): boolean {
  const now = Date.now();
  if (now > globalWindow.resetAt) {
    globalWindow = { count: 1, resetAt: now + RATE_WINDOW_MS };
    return true;
  }
  if (globalWindow.count >= GLOBAL_LIMIT_MAX) return false;
  globalWindow.count++;
  return true;
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 500) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── プロンプト / スキーマ ─────────────────────────────────────────────────────

const VIDEO_PROMPT = `
あなたは料理研究家兼、日本の管理栄養士です。この料理動画からレシピを抽出してください。

手順:
1. 動画で作っている料理を特定し、name に日本語の料理名を入れる。
2. servings: このレシピが何人前ぶんかを動画内の情報から判断する（不明なら映像から推定）。
3. ingredients: 材料を {name, amount} で列挙する。amount は動画内の表記を優先する（例: "200g", "大さじ2", "1/2個"）。分からなければ null。
4. steps: 調理手順を時系列で簡潔に（各1文、日本語）。
5. calories / protein / fat / carbs: 完成した料理の【1人前あたり】の栄養を推定する。
6. 料理動画でない・レシピを特定できない場合は name を null にし、notes に理由を書く。

注意:
- 音声・字幕・テロップの分量情報も活用する。
- 自信の無い数値は null にする。
`.trim();

function buildTextPrompt(text: string): string {
  return `あなたは料理研究家兼、日本の管理栄養士です。次のレシピ文（動画の概要欄・キャプション等）からレシピを構造化して抽出してください。

入力:
"""
${text}
"""

- name: 日本語の料理名。レシピと判断できない入力なら null。
- servings: 何人前ぶんのレシピか（不明なら 1）。
- ingredients: 材料 {name, amount}。amount は原文の表記を保持（例: "200g", "大さじ2"）。無ければ null。
- steps: 手順を時系列で簡潔に（各1文）。原文に手順が無ければ料理名から一般的な作り方を書く。
- calories / protein / fat / carbs: 【1人前あたり】の栄養を推定。自信が無ければ null。
JSONのみで回答してください。`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', nullable: true },
    servings: { type: 'number', nullable: true },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'string', nullable: true },
        },
        required: ['name'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    calories: { type: 'number', nullable: true },
    protein: { type: 'number', nullable: true },
    fat: { type: 'number', nullable: true },
    carbs: { type: 'number', nullable: true },
    notes: { type: 'string', nullable: true },
  },
  required: ['name', 'servings', 'ingredients', 'steps'],
};

const MAX_TEXT_LENGTH = 4000;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!ANALYSIS_ENABLED) {
    return NextResponse.json({ error: 'recipe analysis is disabled' }, { status: 403 });
  }
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  if (!checkRateLimit(ip) || !checkGlobalLimit()) {
    return NextResponse.json(
      { error: 'too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'analysis is not configured' }, { status: 503 });
  }

  // ── 入力（JSON: { youtubeUrl } もしくは { text }） ──────────────────────────
  let payload: { youtubeUrl?: unknown; text?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  let parts: Array<Record<string, unknown>>;
  if (typeof payload.youtubeUrl === 'string' && payload.youtubeUrl.trim()) {
    const videoId = extractYouTubeVideoId(payload.youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'YouTube の動画URLではありません（watch / youtu.be / shorts に対応）' },
        { status: 400 },
      );
    }
    // Gemini は YouTube URL を file_uri としてネイティブに解析できる（公開動画のみ）。
    // videoId を検証済みの正規URLに組み直し、任意パラメータの混入を防ぐ。
    parts = [
      { text: VIDEO_PROMPT },
      { file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` } },
    ];
  } else if (typeof payload.text === 'string' && payload.text.trim()) {
    const text = payload.text.trim().slice(0, MAX_TEXT_LENGTH);
    parts = [{ text: buildTextPrompt(text) }];
  } else {
    return NextResponse.json({ error: 'youtubeUrl or text is required' }, { status: 400 });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      // 動画のフレームを低解像度で処理してトークンを節約（レシピ抽出には十分）
      mediaResolution: 'MEDIA_RESOLUTION_LOW',
    },
  };

  const data = await callGeminiWithFallback(apiKey, body, 'analyze-recipe');
  if (!data) {
    return NextResponse.json({ error: 'AI解析に失敗しました。時間をおいて再度お試しください。' }, { status: 502 });
  }

  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) {
    return NextResponse.json({ error: 'AI解析に失敗しました。時間をおいて再度お試しください。' }, { status: 502 });
  }

  return NextResponse.json(normalizeRecipeAnalysis(extractJson(text)));
}
