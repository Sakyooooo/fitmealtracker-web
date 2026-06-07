import { NextResponse } from 'next/server';
import { GEMINI_ENDPOINT, GEMINI_FALLBACK, extractJson } from '@/lib/gemini';
import { MealAnalysisResult } from '@/lib/types';

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

  // 5. Parse & validate image
  const formData = await request.formData();
  const image = formData.get('image');

  if (!(image instanceof File) || !image.type.startsWith('image/')) {
    return NextResponse.json({ error: 'image file is required' }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: 'image is too large' }, { status: 413 });
  }

  // 6. Call Gemini
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

    if (!res.ok) return NextResponse.json(GEMINI_FALLBACK);

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return NextResponse.json(normalizeResult(extractJson(text) as MealAnalysisResult));
  } catch (error) {
    console.error('[gemini route]', error);
    return NextResponse.json(GEMINI_FALLBACK);
  }
}
