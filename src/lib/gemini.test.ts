import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractJson, analyzeWithGemini, GEMINI_FALLBACK } from './gemini';

// ─────────────────────────────────────────────────────────────────────────────
describe('extractJson', () => {
  it('プレーンな JSON 文字列をパースして返す', () => {
    const text = '{"dishName":"カレー","estimatedCalories":600}';
    expect(extractJson(text)).toEqual({ dishName: 'カレー', estimatedCalories: 600 });
  });

  it('```json ブロックから JSON を抽出する', () => {
    const text = '```json\n{"dishName":"ラーメン","estimatedCalories":700}\n```';
    expect(extractJson(text)).toEqual({ dishName: 'ラーメン', estimatedCalories: 700 });
  });

  it('``` (言語なし) ブロックからも抽出できる', () => {
    const text = '```\n{"dishName":"寿司"}\n```';
    expect(extractJson(text)).toEqual({ dishName: '寿司' });
  });

  it('JSON が含まれない文字列に対して null を返す', () => {
    expect(extractJson('画像を解析できませんでした。')).toBeNull();
  });

  it('空文字列に対して null を返す', () => {
    expect(extractJson('')).toBeNull();
  });

  it('不正な JSON に対して null を返す（クラッシュしない）', () => {
    expect(extractJson('{invalid json}')).toBeNull();
  });

  it('前後に余分なテキストがある場合でも JSON オブジェクトを抽出する', () => {
    const text = '以下のJSONを参照してください。\n{"estimatedCalories":300}\nよろしくお願いします。';
    const result = extractJson(text) as { estimatedCalories: number };
    expect(result?.estimatedCalories).toBe(300);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('analyzeWithGemini', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('API が正常なレスポンスを返した場合、解析結果を返す', async () => {
    const mockResult = {
      dishName: 'チャーハン',
      estimatedCalories: 550,
      confidence: 0.9,
      notes: null,
      protein: 15,
      fat: 20,
      carbs: 80,
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResult), { status: 200 }),
    );
    const file = new File(['dummy'], 'meal.jpg', { type: 'image/jpeg' });
    const result = await analyzeWithGemini(file);
    expect(result.dishName).toBe('チャーハン');
    expect(result.estimatedCalories).toBe(550);
  });

  it('API が 4xx を返した場合、FALLBACK を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('error', { status: 500 }),
    );
    const file = new File(['dummy'], 'meal.jpg', { type: 'image/jpeg' });
    const result = await analyzeWithGemini(file);
    expect(result).toEqual(GEMINI_FALLBACK);
  });

  it('ネットワークエラーが発生した場合、FALLBACK を返す（クラッシュしない）', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'));
    const file = new File(['dummy'], 'meal.jpg', { type: 'image/jpeg' });
    const result = await analyzeWithGemini(file);
    expect(result).toEqual(GEMINI_FALLBACK);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GEMINI_FALLBACK', () => {
  it('estimatedCalories が null である（誤情報を与えない）', () => {
    expect(GEMINI_FALLBACK.estimatedCalories).toBeNull();
  });

  it('必須フィールドがすべて揃っている', () => {
    expect(GEMINI_FALLBACK).toMatchObject({
      dishName: null,
      estimatedCalories: null,
      confidence: expect.any(Number),
      notes: expect.any(String),
      protein: null,
      fat: null,
      carbs: null,
    });
  });
});
