import { MealCategory, Recipe, RecipeIngredient } from './types';

// ── YouTube URL ───────────────────────────────────────────────────────────────

/**
 * YouTube URL から videoId を取り出す。対応形式:
 *   https://www.youtube.com/watch?v=ID / https://youtu.be/ID
 *   https://www.youtube.com/shorts/ID / https://www.youtube.com/embed/ID
 * 対応外の URL は null。
 */
export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

  const host = u.hostname.replace(/^www\.|^m\./, '');
  const isValidId = (id: string | null | undefined): id is string =>
    !!id && /^[A-Za-z0-9_-]{6,20}$/.test(id);

  if (host === 'youtu.be') {
    const id = u.pathname.split('/')[1];
    return isValidId(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v');
      return isValidId(id) ? id : null;
    }
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
    if (m && isValidId(m[2])) return m[2];
  }
  return null;
}

/** videoId からサムネイル URL を導出（保存不要・YouTube公式の静的URL）。 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// ── AI解析結果の正規化 ────────────────────────────────────────────────────────

/** /api/analyze-recipe が返すレシピ抽出結果（正規化済み）。 */
export type RecipeAnalysisResult = {
  name: string | null;      // 抽出できなかった場合は null
  servings: number;         // 1 以上
  ingredients: RecipeIngredient[];
  steps: string[];
  calories: number | null;  // 1人前あたり kcal
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  notes: string | null;
};

const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : null;

/** Gemini の生 JSON を RecipeAnalysisResult に整える。壊れた値は落とす。 */
export function normalizeRecipeAnalysis(parsed: unknown): RecipeAnalysisResult {
  const p = (parsed ?? {}) as Record<string, unknown>;

  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 60) : null;

  const rawServings = p.servings;
  const servings =
    typeof rawServings === 'number' && isFinite(rawServings) && rawServings >= 1
      ? Math.min(20, Math.round(rawServings))
      : 1;

  const ingredients: RecipeIngredient[] = Array.isArray(p.ingredients)
    ? p.ingredients
        .map((it): RecipeIngredient | null => {
          const o = (it ?? {}) as Record<string, unknown>;
          const n = typeof o.name === 'string' ? o.name.trim() : '';
          if (!n) return null;
          const amount =
            typeof o.amount === 'string' && o.amount.trim() ? o.amount.trim().slice(0, 30) : null;
          return { name: n.slice(0, 40), amount };
        })
        .filter((it): it is RecipeIngredient => it !== null)
        .slice(0, 40)
    : [];

  const steps: string[] = Array.isArray(p.steps)
    ? p.steps
        .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        .map((s) => s.trim().slice(0, 200))
        .slice(0, 30)
    : [];

  return {
    name,
    servings,
    ingredients,
    steps,
    calories: numOrNull(p.calories),
    protein: numOrNull(p.protein),
    fat: numOrNull(p.fat),
    carbs: numOrNull(p.carbs),
    notes: typeof p.notes === 'string' && p.notes.trim() ? p.notes.trim().slice(0, 200) : null,
  };
}

// ── 複数レシピ → 1食分の合成 ──────────────────────────────────────────────────

export type RecipePortion = { recipe: Recipe; quantity: number }; // quantity = 人前（0.5刻み）

export type CombinedMeal = {
  name: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
};

/**
 * 選択した複数レシピを1件の食事（1投稿）に合成する。
 * 名前は「、」連結、栄養は quantity 倍で合算。PFC は1つでも値があれば合算（null は 0 扱い）、
 * 全レシピで null の成分は null のまま。
 */
export function combineRecipesForMeal(items: RecipePortion[]): CombinedMeal {
  const name = items.map((i) => i.recipe.name).join('、');

  let calories = 0;
  const sums = { protein: 0, fat: 0, carbs: 0 };
  const has = { protein: false, fat: false, carbs: false };

  for (const { recipe, quantity } of items) {
    calories += (recipe.calories ?? 0) * quantity;
    for (const key of ['protein', 'fat', 'carbs'] as const) {
      const v = recipe[key];
      if (v != null) {
        sums[key] += v * quantity;
        has[key] = true;
      }
    }
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    name,
    calories: Math.round(calories),
    protein: has.protein ? round1(sums.protein) : null,
    fat: has.fat ? round1(sums.fat) : null,
    carbs: has.carbs ? round1(sums.carbs) : null,
  };
}

// ── 時刻 → 食事カテゴリの推定 ─────────────────────────────────────────────────

/** 現在時刻（hour, 0-23）から食事カテゴリを推定する。記録モーダルの初期値用。 */
export function guessMealCategory(hour: number): MealCategory {
  if (hour >= 4 && hour < 10) return '朝食';
  if (hour >= 10 && hour < 15) return '昼食';
  if (hour >= 15 && hour < 22) return '夕食';
  return '間食';
}
