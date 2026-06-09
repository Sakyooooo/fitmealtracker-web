import { NextResponse } from 'next/server';
import { GEMINI_ENDPOINT, GEMINI_FALLBACK, extractJson } from '@/lib/gemini';
import { MealAnalysisResult } from '@/lib/types';
import { applyNutritionDb } from '@/lib/nutritionDb';

// ── Security: feature flag ────────────────────────────────────────────────────
// Set MEAL_ANALYSIS_ENABLED=false in environment to disable the endpoint entirely.
const ANALYSIS_ENABLED = process.env.MEAL_ANALYSIS_ENABLED !== 'false';

// ── Security: rate limiting ───────────────────────────────────────────────────
// Per-IP: max 10 requests per 60 seconds (in-memory, resets on cold start).
const RATE_LIMIT_MAX = 10;
const RATE_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Global backstop: the per-IP bucket keys on x-forwarded-for, which a non-browser
// client can spoof/rotate to bypass the per-IP cap. This global counter bounds the
// TOTAL requests (and therefore Gemini cost) per window regardless of IP.
const GLOBAL_LIMIT_MAX = Number(process.env.MEAL_ANALYSIS_GLOBAL_MAX ?? 60);
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

  // Periodic cleanup to prevent unbounded memory growth
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

// ── Security: origin check ────────────────────────────────────────────────────
// Only allow requests from the same origin (the app itself).
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Explicit allowlist via env (e.g. "https://your-app.vercel.app")
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed) return origin === allowed;

  // Vercel auto-sets VERCEL_URL for preview/production deployments
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return origin === `https://${vercelUrl}`;

  // Local development
  if (process.env.NODE_ENV === 'development') {
    return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  }

  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PROMPT = `
あなたは日本の管理栄養士です。この食事の写真を分析してください。

手順:
1. 写っている料理・食品を特定する（日本語で具体的に。例:「鶏の唐揚げ定食」「ミックスサラダ」「ざるそば」）。
   - 主食・主菜・副菜・付け合わせ・飲み物など、見える要素をすべて考慮する。
2. 料理名の候補を確信度の高い順に最大3つ挙げる（candidates）。最も確からしいものを dishName にも入れる。
3. 見える分量と日本の一般的な一人前を基準に、その料理1食分のカロリー(kcal)と PFC(タンパク質/脂質/炭水化物 g) を推定する。
4. 一般的な一人前と比べた分量を portion として "small"（少なめ）/ "regular"（普通）/ "large"（多め）で表す。
5. 自信が無い数値は推測で埋めず null にする。

注意:
- 料理が複数皿あれば合計の量で見積もる。
- 皿・箸・手などが写っていればスケールの参考にする。
- confidence は dishName の確からしさ（0.0〜1.0）。
`.trim();

// Gemini 構造化出力スキーマ（JSON を確実にパースできるようにする）
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    dishName: { type: 'string', nullable: true },
    candidates: { type: 'array', items: { type: 'string' } },
    estimatedCalories: { type: 'number', nullable: true },
    confidence: { type: 'number', nullable: true },
    protein: { type: 'number', nullable: true },
    fat: { type: 'number', nullable: true },
    carbs: { type: 'number', nullable: true },
    portion: { type: 'string', nullable: true },
    notes: { type: 'string', nullable: true },
  },
  required: ['dishName', 'candidates', 'estimatedCalories', 'confidence'],
};

// 食事名テキストだけからカロリー/PFCを推定する場合のプロンプト。
function buildTextPrompt(dish: string): string {
  return `あなたは日本の管理栄養士です。「${dish}」という料理または食品について、日本の一般的な一人前を基準に栄養を推定してください。
- dishName は「${dish}」（必要なら一般的な表記に整える）。
- candidates に近い料理名を確信度の高い順に最大3つ。
- estimatedCalories(kcal) と PFC(protein/fat/carbs, g) を推定する。portion は "regular"。
- 判断できない、または数値に自信が無い場合は該当値を null にする。
JSONのみで回答してください。`;
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

function normalizeResult(value: Partial<MealAnalysisResult>): MealAnalysisResult {
  const candidates = Array.isArray(value.candidates)
    ? Array.from(new Set(
        value.candidates.filter((c): c is string => typeof c === 'string' && c.trim() !== ''),
      )).slice(0, 3)
    : null;
  return {
    dishName: typeof value.dishName === 'string' ? value.dishName : (candidates?.[0] ?? null),
    candidates: candidates && candidates.length > 0 ? candidates : null,
    estimatedCalories:
      typeof value.estimatedCalories === 'number' ? value.estimatedCalories : null,
    confidence: typeof value.confidence === 'number' ? value.confidence : null,
    notes: typeof value.notes === 'string' ? value.notes : null,
    protein: typeof value.protein === 'number' ? value.protein : null,
    fat: typeof value.fat === 'number' ? value.fat : null,
    carbs: typeof value.carbs === 'number' ? value.carbs : null,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // 1. Feature flag
  if (!ANALYSIS_ENABLED) {
    return NextResponse.json({ error: 'meal analysis is disabled' }, { status: 403 });
  }

  // 2. Origin check
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 3. Rate limit
  //    NOTE: x-forwarded-for is client-spoofable (a non-browser client can rotate it
  //    to defeat the per-IP cap). The per-IP limit is best-effort; the global cap below
  //    is the real backstop against API-cost abuse.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  if (!checkRateLimit(ip) || !checkGlobalLimit()) {
    return NextResponse.json(
      { error: 'too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  // 4. API key guard
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(GEMINI_FALLBACK);
  }

  // 5. Parse input（画像 もしくは 食事名テキスト）
  const formData = await request.formData();
  const image = formData.get('image');
  const nameField = formData.get('name');

  let parts: Array<Record<string, unknown>>;
  let isTextMode = false;
  if (image instanceof File && image.type.startsWith('image/')) {
    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: 'image is too large' }, { status: 413 });
    }
    const base64 = Buffer.from(await image.arrayBuffer()).toString('base64');
    parts = [
      { text: PROMPT },
      { inline_data: { mime_type: image.type, data: base64 } },
    ];
  } else if (typeof nameField === 'string' && nameField.trim()) {
    parts = [{ text: buildTextPrompt(nameField.trim().slice(0, 60)) }];
    isTextMode = true;
  } else {
    return NextResponse.json({ error: 'image file or name is required' }, { status: 400 });
  }

  // 6. Call Gemini
  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  // Gemini はモデル過負荷で 503 / 429 を返すことがある。
  //  - 同一モデルで短い指数バックオフ付きリトライ
  //  - それでもダメなら flash-lite にフォールバック
  // のどちらかで一時的なエラーを吸収し「そもそも出ない」を減らす。
  const data = await callGeminiWithFallback(apiKey, body);
  if (!data) return NextResponse.json(GEMINI_FALLBACK);

  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) return NextResponse.json(GEMINI_FALLBACK);

  const parsed = extractJson(text) as (MealAnalysisResult & { portion?: string | null }) | null;
  const normalized = normalizeResult(parsed ?? {});
  // 料理名は AI、カロリー/PFC は栄養成分表で決定的に算出（ヒット時のみ上書き）。
  // テキスト推定では候補での誤マッチを避けるため入力名のみで照合する。
  const final = applyNutritionDb(normalized, parsed?.portion, { matchCandidates: !isTextMode });
  return NextResponse.json(final);
}

// ── Gemini 呼び出し（リトライ＋フォールバック） ───────────────────────────────
// ユーザー設定: メイン=gemini-3.1-flash-lite（gemini.ts）、
// フォールバックは別系の gemini-2.5-flash-lite（モデル障害時の退避先）。
const GEMINI_FALLBACK_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGeminiWithFallback(
  apiKey: string,
  body: unknown,
): Promise<{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null> {
  // 第一候補は高精度な flash、ダメなら軽量な flash-lite。
  const endpoints = [GEMINI_ENDPOINT, GEMINI_FALLBACK_ENDPOINT];

  for (const endpoint of endpoints) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) return await res.json();

        const status = res.status;
        if (!RETRYABLE_STATUS.has(status)) {
          // 4xx（スキーマ不正・認証など）はリトライしても無駄なので次モデルへ
          const detail = (await res.text().catch(() => '')).slice(0, 200);
          console.error('[gemini] non-retryable HTTP', status, detail);
          break;
        }
        // リトライ可能エラー: 指数バックオフ＋ジッター
        console.warn('[gemini] retryable HTTP', status, `endpoint=${endpoint} attempt=${attempt}`);
        await sleep(400 * (attempt + 1) + Math.floor(Math.random() * 300));
      } catch (error) {
        console.error('[gemini] fetch error', error);
        await sleep(300);
      }
    }
  }
  return null;
}
