import { NextResponse } from 'next/server';
import { GEMINI_ENDPOINT, GEMINI_FALLBACK, extractJson } from '@/lib/gemini';
import { MealAnalysisResult } from '@/lib/types';
import { applyNutritionDb, lookupNutrition } from '@/lib/nutritionDb';
import { isAllowedRequestOrigin } from '@/lib/apiOrigin';

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

// 複数料理をまとめて分解・推定する場合のプロンプト（テキスト入力）。
function buildMultiTextPrompt(text: string): string {
  return `あなたは日本の管理栄養士です。次の食事メモに含まれる料理・食品を**それぞれ分解**し、各料理について日本の一般的な一人前を基準に栄養を推定してください。
入力: 「${text}」
- items 配列で、各料理を {name(料理名), calories(kcal), protein, fat, carbs(g)} として返す。
- 「と」「や」「、」などで複数の料理が書かれていれば、すべて個別の要素として列挙する。
- 同じ料理が重複していれば1件にまとめ量に反映する。
- 各 calories は概算でよいが null は避ける。PFCは自信が無ければ null 可。
JSONのみで回答してください。`;
}

// 複数推定モードの構造化出力スキーマ。
const MULTI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          calories: { type: 'number', nullable: true },
          protein: { type: 'number', nullable: true },
          fat: { type: 'number', nullable: true },
          carbs: { type: 'number', nullable: true },
        },
        required: ['name', 'calories'],
      },
    },
  },
  required: ['items'],
};

type MultiItem = {
  name: string;
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  serving: string | null;
  source: 'db' | 'ai';
};

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

/** Gemini の items を、静的成分表優先で MultiItem[] に整える。 */
function parseMultiItems(parsed: unknown): MultiItem[] {
  const raw = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(raw)) return [];
  const out: MultiItem[] = [];
  for (const it of raw) {
    const name = typeof (it as { name?: unknown })?.name === 'string' ? (it as { name: string }).name.trim() : '';
    if (!name) continue;
    const db = lookupNutrition(name);
    if (db) {
      out.push({ name, kcal: db.kcal, protein: db.p, fat: db.f, carbs: db.c, serving: db.serving, source: 'db' });
      continue;
    }
    const kcal = numOrNull((it as { calories?: unknown }).calories);
    if (kcal == null || kcal <= 0) continue;
    out.push({
      name,
      kcal: Math.round(kcal),
      protein: numOrNull((it as { protein?: unknown }).protein),
      fat: numOrNull((it as { fat?: unknown }).fat),
      carbs: numOrNull((it as { carbs?: unknown }).carbs),
      serving: '1人前',
      source: 'ai',
    });
    if (out.length >= 12) break;
  }
  return out;
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

  // 2. Origin check（同一オリジン / 許可ドメインのみ）
  if (!isAllowedRequestOrigin(request)) {
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
  let isMulti = false;
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
    isTextMode = true;
    isMulti = formData.get('mode') === 'multi';
    const dish = nameField.trim().slice(0, isMulti ? 200 : 60);
    parts = [{ text: isMulti ? buildMultiTextPrompt(dish) : buildTextPrompt(dish) }];
  } else {
    return NextResponse.json({ error: 'image file or name is required' }, { status: 400 });
  }

  // 6. Call Gemini
  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: isMulti ? MULTI_RESPONSE_SCHEMA : RESPONSE_SCHEMA,
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

  // 複数推定モード: 分解した品目リストを返す
  if (isMulti) {
    return NextResponse.json({ items: parseMultiItems(parsed) });
  }

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
