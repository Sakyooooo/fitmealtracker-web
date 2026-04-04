/**
 * services/photo.ts
 *
 * 食事写真の解析責務を担うサービス。
 * 画像選択・永続化は services/imagePicker.ts に分離済み。
 *
 * ─── アーキテクチャ ───────────────────────────────────────────────────────────
 *
 *  analyzeMealPhoto(photoUri)
 *       │
 *       ├─ EXPO_PUBLIC_GEMINI_API_KEY が設定されている → Gemini 1.5 Flash（直接）
 *       │
 *       ├─ EXPO_PUBLIC_API_BASE_URL が設定されている → Claude プロキシ経由
 *       │
 *       └─ どちらも未設定 → analyzeWithMock()（開発・デモ用）
 *
 * ─── Gemini API キーの設定方法 ────────────────────────────────────────────────
 *
 *  1. https://aistudio.google.com/ で API キーを取得
 *  2. .env に設定:
 *       EXPO_PUBLIC_GEMINI_API_KEY=AIza...
 *  3. Expo を再起動する（環境変数の読み込みが必要）
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';
import { MealAnalysisResult } from '../types';

// 後方互換のため imagePicker の公開 API をそのまま再エクスポート
export {
  pickImageFromLibrary,
  takePhotoWithCamera,
  savePhotoToAppDir,
} from './imagePicker';

// ─── プロンプト定数 ───────────────────────────────────────────────────────────
export const MEAL_ANALYSIS_PROMPT = `
この料理の画像を分析してください。
以下のJSONのみを返してください（他のテキスト・マークダウン不要）:
{
  "dishName": "料理名（日本語で具体的に。不明なら null）",
  "estimatedCalories": 数値（kcal、不明なら null）,
  "confidence": 0.0〜1.0（推定の確信度）,
  "protein": 数値（タンパク質 g、不明なら null）,
  "fat": 数値（脂質 g、不明なら null）,
  "carbs": 数値（炭水化物 g、不明なら null）,
  "notes": "補足説明（食材の推定、注意点など。不要なら null）"
}
`.trim();

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

function getMediaType(uri: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Gemini 送信前に画像を圧縮・リサイズして base64 を返す。
 * 長辺を 768px 以下・JPEG 品質 70% に落としてトークン数を削減する。
 */
async function compressToBase64(uri: string): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 768 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return { base64: compressed.base64 ?? '', mimeType: 'image/jpeg' };
}

/**
 * レスポンステキストから JSON オブジェクトを安全に抽出する。
 * - ```json ... ``` コードブロックに対応
 * - 裸の { ... } にも対応
 */
function extractJson(text: string): unknown {
  // コードブロック
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* fall through */ }
  }
  // 最初の { ... }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) {
    try { return JSON.parse(brace[0]); } catch { /* fall through */ }
  }
  throw new Error('レスポンスに有効な JSON が含まれていません');
}

// ─── Gemini 1.5 Flash（直接呼び出し） ────────────────────────────────────────

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

const GEMINI_FALLBACK: MealAnalysisResult = {
  dishName: '料理名を入力してください',
  estimatedCalories: 500,
  confidence: 0,
  protein: null,
  fat: null,
  carbs: null,
  notes: 'AI推定に失敗しました。手動で入力してください。',
};

async function callGeminiOnce(
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<{ status: number; result?: MealAnalysisResult }> {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: MEAL_ANALYSIS_PROMPT },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(`[photo] Gemini HTTP ${response.status}:`, body.slice(0, 300));
    return { status: response.status };
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = extractJson(rawText) as Record<string, unknown>;
  const result: MealAnalysisResult = {
    dishName:          typeof parsed.dishName === 'string'          ? parsed.dishName          : null,
    estimatedCalories: typeof parsed.estimatedCalories === 'number' ? parsed.estimatedCalories : null,
    confidence:        typeof parsed.confidence === 'number'        ? parsed.confidence        : null,
    protein:           typeof parsed.protein === 'number'           ? parsed.protein           : null,
    fat:               typeof parsed.fat === 'number'               ? parsed.fat               : null,
    carbs:             typeof parsed.carbs === 'number'             ? parsed.carbs             : null,
    notes:             typeof parsed.notes === 'string'             ? parsed.notes             : null,
  };
  return { status: 200, result };
}

async function analyzeWithGemini(
  base64: string,
  mimeType: string,
  apiKey: string,
  onRetrying?: () => void,
): Promise<MealAnalysisResult> {
  const first = await callGeminiOnce(base64, mimeType, apiKey);
  if (first.status !== 429 && first.result) return first.result;
  if (first.status !== 429) {
    throw new Error(`Gemini HTTP ${first.status}`);
  }

  // 429 レート制限 → 30秒待ってリトライ
  console.warn('[photo] Gemini 429: 30秒後にリトライします');
  onRetrying?.();
  await new Promise((r) => setTimeout(r, 30_000));

  const retry = await callGeminiOnce(base64, mimeType, apiKey);
  if (retry.result) return retry.result;

  // リトライも失敗 → フォールバック
  console.warn('[photo] リトライも失敗。フォールバック値を返します');
  return GEMINI_FALLBACK;
}

// ─── Claude プロキシ経由 ──────────────────────────────────────────────────────

async function analyzeWithProxy(
  base64: string,
  mediaType: string,
  proxyBaseUrl: string,
): Promise<MealAnalysisResult> {
  const response = await fetch(`${proxyBaseUrl}/analyze-meal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType }),
  });
  if (!response.ok) {
    throw new Error(`Proxy error: HTTP ${response.status}`);
  }
  return (await response.json()) as MealAnalysisResult;
}

// ─── 開発用モック ─────────────────────────────────────────────────────────────

async function analyzeWithMock(): Promise<MealAnalysisResult> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    dishName: '料理名（テスト）',
    estimatedCalories: 420,
    confidence: 0.75,
    protein: 18,
    fat: 12,
    carbs: 55,
    notes: 'これはモック値です。EXPO_PUBLIC_GEMINI_API_KEY を設定してください。',
  };
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * 食事写真を解析して料理名・カロリー・PFC・信頼度を返す。
 *
 * 優先順位:
 *  1. EXPO_PUBLIC_GEMINI_API_KEY → Gemini 1.5 Flash（直接）
 *  2. EXPO_PUBLIC_API_BASE_URL   → Claude プロキシ
 *  3. どちらも未設定             → モック
 *
 * @param photoUri   - 解析する画像の file:// URI
 * @param onRetrying - 429 リトライ待機開始時に呼ばれるコールバック（任意）
 */
export async function analyzeMealPhoto(
  photoUri: string,
  onRetrying?: () => void,
): Promise<MealAnalysisResult> {
  const geminiKey: string = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
  const apiBaseUrl: string = Constants.expoConfig?.extra?.apiBaseUrl ?? '';

  try {
    if (geminiKey) {
      // 圧縮してトークン数を削減（429 対策）
      const { base64, mimeType } = await compressToBase64(photoUri);
      console.log(`[photo] 圧縮後 base64 長さ: ${base64.length}`);
      return await analyzeWithGemini(base64, mimeType, geminiKey, onRetrying);
    }

    if (apiBaseUrl) {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mediaType = getMediaType(photoUri);
      return await analyzeWithProxy(base64, mediaType, apiBaseUrl);
    }
  } catch (e) {
    console.warn('[photo] 解析エラー:', e);
    return {
      dishName: null,
      estimatedCalories: null,
      confidence: null,
      protein: null,
      fat: null,
      carbs: null,
      notes: `解析に失敗しました: ${e instanceof Error ? e.message : '不明なエラー'}`,
    };
  }

  // モック（開発用）
  return analyzeWithMock();
}

/**
 * analyzeMealPhoto のラッパー。カロリーのみ返す簡易版。
 */
export async function estimateMealCaloriesFromPhoto(photoUri: string): Promise<number | null> {
  const result = await analyzeMealPhoto(photoUri);
  return result.estimatedCalories;
}
