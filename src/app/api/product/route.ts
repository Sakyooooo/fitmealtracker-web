import { NextResponse } from 'next/server';
import { ProductLookupResult } from '@/lib/types';
import { isAllowedRequestOrigin } from '@/lib/apiOrigin';

// ── Security: 簡易レート制限（in-memory・cold start でリセット） ────────────────
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateOk(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 500) for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return true; }
  if (e.count >= RATE_MAX) return false;
  e.count++;
  return true;
}

// ── Open Food Facts ───────────────────────────────────────────────────────────
const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = [
  'product_name', 'product_name_ja', 'generic_name', 'brands',
  'nutriments', 'serving_size', 'quantity', 'image_front_small_url',
].join(',');
// OFF は識別可能な User-Agent を求めている。
const OFF_UA = 'FitMealTracker/1.0 (personal MVP; +https://github.com/Sakyooooo/fitmealtracker-web)';

const NOT_FOUND = (barcode: string | null): ProductLookupResult => ({
  found: false, barcode, name: null, brand: null, imageUrl: null,
  servingLabel: null, basis: null, calories: null, protein: null,
  fat: null, carbs: null, source: 'off',
});

function num(v: unknown): number | null {
  const x = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : null;
}

/** kcal が無く kJ だけある場合は換算（1 kcal ≒ 4.184 kJ）。 */
function kcalFrom(kcal: unknown, kj: unknown): number | null {
  const direct = num(kcal);
  if (direct != null) return direct;
  const j = num(kj);
  return j != null ? Math.round(j / 4.184) : null;
}

const round1 = (x: number | null): number | null => (x == null ? null : Math.round(x * 10) / 10);

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  if (!rateOk(ip)) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const body = await request.json().catch(() => ({}));
  const barcode = String((body as { code?: unknown }).code ?? '').replace(/\D/g, '');
  if (barcode.length < 8 || barcode.length > 14) {
    return NextResponse.json(NOT_FOUND(null));
  }

  try {
    const res = await fetch(`${OFF_ENDPOINT}/${barcode}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': OFF_UA, Accept: 'application/json' },
    });
    if (!res.ok) return NextResponse.json(NOT_FOUND(barcode));

    const data = await res.json();
    if (data?.status !== 1 || !data?.product) return NextResponse.json(NOT_FOUND(barcode));

    const p = data.product as Record<string, unknown>;
    const n = (p.nutriments ?? {}) as Record<string, unknown>;

    const kcalServing = kcalFrom(n['energy-kcal_serving'], n['energy-kj_serving']);
    const kcal100 = kcalFrom(n['energy-kcal_100g'], n['energy-kj_100g']);
    const servingSize = typeof p.serving_size === 'string' ? p.serving_size : null;

    // 1食分の値があればそれを、無ければ100gあたりを採用。
    const useServing = kcalServing != null || (!!servingSize && num(n['proteins_serving']) != null);
    const basis: 'serving' | '100g' = useServing ? 'serving' : '100g';
    const suffix = useServing ? '_serving' : '_100g';

    const name =
      (typeof p.product_name_ja === 'string' && p.product_name_ja) ||
      (typeof p.product_name === 'string' && p.product_name) ||
      (typeof p.generic_name === 'string' && p.generic_name) ||
      null;

    const result: ProductLookupResult = {
      found: true,
      barcode,
      name: name || null,
      brand: typeof p.brands === 'string' ? p.brands : null,
      imageUrl: typeof p.image_front_small_url === 'string' ? p.image_front_small_url : null,
      servingLabel: useServing ? (servingSize ?? '1食分') : '100gあたり',
      basis,
      calories: useServing ? kcalServing ?? kcal100 : kcal100,
      protein: round1(num(n[`proteins${suffix}`])),
      fat: round1(num(n[`fat${suffix}`])),
      carbs: round1(num(n[`carbohydrates${suffix}`])),
      source: 'off',
    };

    // カロリーが整数で来ないことがあるので丸める
    if (result.calories != null) result.calories = Math.round(result.calories);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[product route]', error);
    return NextResponse.json(NOT_FOUND(barcode));
  }
}
