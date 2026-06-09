import { FoodCompositionItem } from './types';

// 日本食品標準成分表（八訂）約2,478品。初期バンドルに載せず初回検索時に取得する。
let cache: FoodCompositionItem[] | null = null;
let loading: Promise<FoodCompositionItem[]> | null = null;

/** カタカナをひらがなへ寄せる（検索の表記ゆれ吸収）。 */
function kataToHira(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    out += code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : ch;
  }
  return out;
}

function normalizeQuery(q: string): string {
  return kataToHira(
    q.toLowerCase().replace(/[\s　・,，.．。\-[\]（）()【】「」<>＜＞/／]/g, ''),
  );
}

/** 成分表JSONを取得（メモ化）。失敗時は空配列。 */
export async function loadFoodComposition(): Promise<FoodCompositionItem[]> {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch('/data/food_composition.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cache = (json?.items ?? []) as FoodCompositionItem[];
      return cache;
    } catch (e) {
      console.error('[foodComposition] load failed:', e);
      cache = [];
      return cache;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/**
 * 食品名で検索。全角/半角・かな表記ゆれを吸収し、
 * 「前方一致 > 部分一致」「名前が短い＝より一般的」を優先して上位を返す。
 */
export async function searchFoods(query: string, limit = 30): Promise<FoodCompositionItem[]> {
  const q = normalizeQuery(query);
  if (q.length < 1) return [];
  const items = await loadFoodComposition();

  const scored: { item: FoodCompositionItem; score: number }[] = [];
  for (const item of items) {
    const idx = item.searchKey.indexOf(q);
    if (idx === -1) continue;
    // 前方一致を優遇、名前が短いほど一般的とみなして加点
    const score = (idx === 0 ? 0 : 100) + idx + item.name.length * 0.1;
    scored.push({ item, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.item);
}
