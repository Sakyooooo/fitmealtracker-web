import { ProductLookupResult } from './types';

const NOT_FOUND = (barcode: string | null): ProductLookupResult => ({
  found: false, barcode, name: null, brand: null, imageUrl: null,
  servingLabel: null, basis: null, calories: null, protein: null,
  fat: null, carbs: null, source: 'off',
});

/** バーコード（JAN/EAN/UPC）から市販品の栄養を Open Food Facts 経由で取得する。 */
export async function lookupProductByBarcode(code: string): Promise<ProductLookupResult> {
  const barcode = (code ?? '').replace(/\D/g, '');
  if (barcode.length < 8) return NOT_FOUND(barcode || null);
  try {
    const res = await fetch('/api/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: barcode }),
    });
    if (!res.ok) return NOT_FOUND(barcode);
    return (await res.json()) as ProductLookupResult;
  } catch (e) {
    console.error('[openFoodFacts]', e);
    return NOT_FOUND(barcode);
  }
}
