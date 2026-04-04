/**
 * backend/server.js
 *
 * FitMealTracker — Claude API プロキシサーバー
 *
 * ════════════════════════════════════════════════════════════════
 *  起動手順
 * ════════════════════════════════════════════════════════════════
 *
 *  1. API キーを設定
 *       cd backend
 *       cp .env.example .env
 *       # .env を開いて ANTHROPIC_API_KEY=sk-ant-... を記入
 *
 *  2. 依存パッケージをインストール
 *       npm install
 *
 *  3. サーバーを起動
 *       node server.js
 *       # または: npm start
 *       # または: プロジェクトルートから npm run backend
 *
 *  4. PC の LAN IP アドレスを確認
 *       Windows: ipconfig  →  IPv4 アドレス (例: 192.168.1.10)
 *       Mac    : ifconfig en0  →  inet (例: 192.168.1.10)
 *
 *  5. Expo 側の .env を設定（プロジェクトルート）
 *       EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3001/api
 *
 *  6. Expo を再起動
 *       npx expo start
 *       ※ 環境変数は起動時にのみ読み込まれます
 *
 * ════════════════════════════════════════════════════════════════
 *  エンドポイント
 * ════════════════════════════════════════════════════════════════
 *
 *  POST /api/analyze-meal
 *    リクエスト: { base64: string, mediaType: "image/jpeg"|"image/png"|"image/webp" }
 *    レスポンス: {
 *      dishName: string|null,
 *      estimatedCalories: number|null,
 *      confidence: number|null,
 *      protein: number|null,
 *      fat: number|null,
 *      carbs: number|null,
 *      notes: string|null
 *    }
 *
 *  GET /api/health
 *    サーバー死活確認
 */

require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();

// ─── ミドルウェア ─────────────────────────────────────────────────────────────
// React Native は CORS の制約を受けないが、Web 対応・将来のデバッグツール向けに追加
app.use(cors());
// Base64 画像は大きいため上限を拡張（1枚 = 最大約 5MB の base64 文字列）
app.use(express.json({ limit: '20mb' }));

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ANALYSIS_PROMPT = `
この食事の写真を解析してください。
以下のJSONのみを返してください（他のテキスト・マークダウン不要）:
{
  "dishName": "料理名（不明なら null）",
  "estimatedCalories": 数値（kcal、不明なら null）,
  "confidence": 0.0〜1.0（推定の確信度）,
  "protein": 数値（タンパク質 g、不明なら null）,
  "fat": 数値（脂質 g、不明なら null）,
  "carbs": 数値（炭水化物 g、不明なら null）,
  "notes": "補足説明（食材の推定、注意点など。不要なら null）"
}
`.trim();

// ─── ヘルパー: Claude レスポンスから JSON を安全に抽出 ─────────────────────────
function extractJson(text) {
  // 1. コードブロック ```json ... ``` を除去
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* fall through */ }
  }
  // 2. 最初の { ... } を直接パース
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) {
    try { return JSON.parse(brace[0]); } catch { /* fall through */ }
  }
  throw new Error('Claude のレスポンスに有効な JSON が含まれていません');
}

// ─── POST /api/analyze-meal ───────────────────────────────────────────────────
app.post('/api/analyze-meal', async (req, res) => {
  const { base64, mediaType } = req.body;

  // バリデーション
  if (!base64 || typeof base64 !== 'string') {
    return res.status(400).json({ error: 'base64 画像データが必要です' });
  }
  if (!mediaType || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
    return res.status(400).json({ error: 'mediaType は image/jpeg / image/png / image/webp のいずれかです' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'サーバーに ANTHROPIC_API_KEY が設定されていません' });
  }

  console.log(`[analyze-meal] 受信 — mediaType: ${mediaType}, base64 長さ: ${base64.length}`);

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: ANALYSIS_PROMPT },
          ],
        },
      ],
    });

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text : '';
    console.log(`[analyze-meal] Claude 応答:\n${rawText}`);

    const result = extractJson(rawText);

    // 必須フィールドを保証（Claude が省略した場合に null で補完）
    const safe = {
      dishName: result.dishName ?? null,
      estimatedCalories: result.estimatedCalories ?? null,
      confidence: result.confidence ?? null,
      protein: result.protein ?? null,
      fat: result.fat ?? null,
      carbs: result.carbs ?? null,
      notes: result.notes ?? null,
    };

    console.log(`[analyze-meal] 返却:`, safe);
    return res.json(safe);

  } catch (err) {
    console.error('[analyze-meal] エラー:', err);
    return res.status(500).json({
      dishName: null,
      estimatedCalories: null,
      confidence: null,
      protein: null,
      fat: null,
      carbs: null,
      notes: `解析エラー: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    apiKeySet: !!process.env.ANTHROPIC_API_KEY,
  });
});

// ─── 起動 ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  FitMealTracker Proxy Server                ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  URL  : http://0.0.0.0:${PORT}                  ║`);
  console.log(`║  Key  : ${process.env.ANTHROPIC_API_KEY ? '✅ 設定済み' : '❌ 未設定 (.env を確認)'}           ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Expo .env に以下を設定してください:         ║');
  console.log('║  EXPO_PUBLIC_API_BASE_URL=                  ║');
  console.log('║    http://<あなたのPCのIP>:' + PORT + '/api      ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});
