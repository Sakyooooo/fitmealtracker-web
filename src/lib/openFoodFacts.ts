import { ProductLookupResult } from './types';
import { getCachedProduct, setCachedProduct } from './localRepository';

const NOT_FOUND = (barcode: string | null): ProductLookupResult => ({
  found: false, barcode, name: null, brand: null, imageUrl: null,
  servingLabel: null, basis: null, calories: null, protein: null,
  fat: null, carbs: null, source: 'off',
});

/**
 * バーコード（JAN/EAN/UPC）から市販品の栄養を取得する。
 * ローカルキャッシュ（30日）→ /api/product（Open Food Facts）の順で解決し、
 * ヒット結果はキャッシュして次回以降を高速化・オフライン耐性化する。
 * （マイ食品の優先参照は呼び出し側 AddMealModal で実施）
 */
export async function lookupProductByBarcode(code: string): Promise<ProductLookupResult> {
  const barcode = (code ?? '').replace(/\D/g, '');
  if (barcode.length < 8) return NOT_FOUND(barcode || null);

  const cached = getCachedProduct(barcode);
  if (cached) return cached;

  try {
    const res = await fetch('/api/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: barcode }),
    });
    if (!res.ok) return NOT_FOUND(barcode);
    const result = (await res.json()) as ProductLookupResult;
    if (result.found) setCachedProduct(barcode, result); // 見つかった結果のみキャッシュ
    return result;
  } catch (e) {
    console.error('[openFoodFacts]', e);
    return NOT_FOUND(barcode);
  }
}
