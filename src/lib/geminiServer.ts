import { GEMINI_ENDPOINT } from './gemini';

// サーバー専用: Gemini 生成APIをリトライ＋モデルフォールバック付きで呼ぶ。
// analyze-meal / analyze-recipe など複数のルートで共有する。
//
// - メイン: GEMINI_ENDPOINT（gemini-3.1-flash-lite）
// - フォールバック: gemini-2.5-flash-lite（モデル過負荷時の退避先）
// - 429/5xx は指数バックオフで各モデル2回まで再試行、4xxは即次モデルへ。

const GEMINI_FALLBACK_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export async function callGeminiWithFallback(
  apiKey: string,
  body: unknown,
  logTag = 'gemini',
): Promise<GeminiResponse | null> {
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
          console.error(`[${logTag}] non-retryable HTTP`, status, detail);
          break;
        }
        // リトライ可能エラー: 指数バックオフ＋ジッター
        console.warn(`[${logTag}] retryable HTTP`, status, `endpoint=${endpoint} attempt=${attempt}`);
        await sleep(400 * (attempt + 1) + Math.floor(Math.random() * 300));
      } catch (error) {
        console.error(`[${logTag}] fetch error`, error);
        await sleep(300);
      }
    }
  }
  return null;
}
