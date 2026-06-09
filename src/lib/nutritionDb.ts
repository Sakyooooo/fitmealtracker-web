import { MealAnalysisResult } from './types';

/**
 * 料理名 → 栄養（1食分の標準値）のローカルテーブル。
 *
 * 目的: カロリー/PFC をLLMの「皿全体の当てずっぽう」に任せず、料理名（LLMが得意）で
 * 引いた決定的な値に置き換えて数値のブレを無くす。外部API・APIキー不要。
 *
 * 値は日本の一般的な一人前を基準にした概算。完璧な精度ではなく「毎回同じ・常識的な値」を
 * 返すことを優先する（ユーザーは自由に修正できる）。
 */
export type NutritionEntry = {
  /** 表示名（マッチした料理） */
  name: string;
  /** この料理を示すキーワード（部分一致用・2文字以上） */
  keywords: string[];
  /** 標準一人前の値 */
  kcal: number;
  p: number; // タンパク質 g
  f: number; // 脂質 g
  c: number; // 炭水化物 g
  serving: string; // 例: "1杯", "1人前"
};

// 注: より具体的な語（例「とんかつ定食」）が一般語（「とんかつ」）に勝つよう、
// マッチは「クエリに含まれるキーワードのうち最長のもの」を採用する。
const TABLE: NutritionEntry[] = [
  // ── ご飯・丼もの ──
  { name: '白米ごはん', keywords: ['白米', '白ごはん', '白ご飯', 'ライス', 'ごはん', 'ご飯'], kcal: 252, p: 3.8, f: 0.5, c: 55, serving: '茶碗1杯(150g)' },
  { name: '牛丼', keywords: ['牛丼', 'ぎゅうどん'], kcal: 730, p: 22, f: 25, c: 103, serving: '並盛' },
  { name: '親子丼', keywords: ['親子丼'], kcal: 640, p: 30, f: 15, c: 95, serving: '1杯' },
  { name: 'カツ丼', keywords: ['カツ丼', 'かつ丼'], kcal: 870, p: 32, f: 32, c: 110, serving: '1杯' },
  { name: '天丼', keywords: ['天丼'], kcal: 700, p: 18, f: 20, c: 110, serving: '1杯' },
  { name: '海鮮丼', keywords: ['海鮮丼', '鉄火丼', 'まぐろ丼'], kcal: 500, p: 28, f: 8, c: 80, serving: '1杯' },
  { name: 'カレーライス', keywords: ['カレーライス', 'ビーフカレー', 'ポークカレー', 'チキンカレー', 'カレー'], kcal: 700, p: 15, f: 22, c: 105, serving: '1皿' },
  { name: 'チャーハン', keywords: ['チャーハン', '炒飯', '焼き飯', 'やきめし'], kcal: 700, p: 16, f: 20, c: 105, serving: '1人前' },
  { name: 'オムライス', keywords: ['オムライス'], kcal: 650, p: 18, f: 25, c: 85, serving: '1皿' },
  { name: 'ビビンバ', keywords: ['ビビンバ', 'ビビンパ'], kcal: 600, p: 22, f: 18, c: 85, serving: '1杯' },
  { name: 'おにぎり', keywords: ['おにぎり', 'おむすび', '塩むすび'], kcal: 180, p: 3, f: 0.5, c: 40, serving: '1個' },
  { name: '弁当', keywords: ['幕の内弁当', 'お弁当', '弁当'], kcal: 700, p: 25, f: 22, c: 95, serving: '1食' },
  { name: '寿司', keywords: ['握り寿司', 'にぎり寿司', '寿司盛り合わせ', '寿司', 'すし', '鮨'], kcal: 500, p: 24, f: 7, c: 80, serving: '1人前(8〜10貫)' },
  { name: '刺身', keywords: ['刺身盛り合わせ', 'お刺身', '刺身', '刺し身'], kcal: 180, p: 30, f: 6, c: 3, serving: '1人前' },

  // ── 麺類 ──
  { name: 'ラーメン', keywords: ['醤油ラーメン', '味噌ラーメン', '塩ラーメン', '豚骨ラーメン', '中華そば', 'ラーメン', 'らーめん'], kcal: 500, p: 20, f: 15, c: 70, serving: '1杯' },
  { name: 'つけ麺', keywords: ['つけ麺', 'つけめん'], kcal: 700, p: 28, f: 18, c: 100, serving: '1杯' },
  { name: '担々麺', keywords: ['担々麺', '坦々麺', 'タンタンメン'], kcal: 650, p: 24, f: 30, c: 70, serving: '1杯' },
  { name: 'うどん', keywords: ['かけうどん', '釜玉うどん', 'うどん'], kcal: 350, p: 10, f: 2, c: 70, serving: '1杯' },
  { name: 'そば', keywords: ['ざるそば', 'かけそば', 'ざる蕎麦', 'そば', '蕎麦'], kcal: 320, p: 12, f: 2, c: 62, serving: '1杯' },
  { name: '焼きそば', keywords: ['焼きそば', 'やきそば'], kcal: 540, p: 14, f: 20, c: 75, serving: '1人前' },
  { name: 'そうめん', keywords: ['そうめん', '素麺'], kcal: 350, p: 9, f: 1, c: 72, serving: '1人前' },
  { name: 'パスタ', keywords: ['ペペロンチーノ', 'ナポリタン', 'ミートソース', 'カルボナーラ', 'スパゲッティ', 'スパゲティ', 'パスタ'], kcal: 600, p: 18, f: 20, c: 85, serving: '1皿' },

  // ── 主菜・定食 ──
  { name: '唐揚げ定食', keywords: ['唐揚げ定食', 'からあげ定食'], kcal: 850, p: 38, f: 35, c: 90, serving: '1食' },
  { name: 'とんかつ定食', keywords: ['とんかつ定食', 'トンカツ定食', 'カツ定食'], kcal: 950, p: 38, f: 45, c: 95, serving: '1食' },
  { name: '生姜焼き定食', keywords: ['生姜焼き定食', 'しょうが焼き定食'], kcal: 800, p: 32, f: 35, c: 85, serving: '1食' },
  { name: '焼き魚定食', keywords: ['焼き魚定食', '焼魚定食', '定食'], kcal: 650, p: 35, f: 18, c: 80, serving: '1食' },
  { name: '唐揚げ', keywords: ['鶏の唐揚げ', '唐揚げ', 'からあげ', 'ザンギ'], kcal: 450, p: 28, f: 28, c: 20, serving: '5個程度' },
  { name: 'とんかつ', keywords: ['ロースかつ', 'とんかつ', 'トンカツ', '豚カツ', 'カツレツ'], kcal: 500, p: 25, f: 35, c: 20, serving: '1枚' },
  { name: '生姜焼き', keywords: ['豚の生姜焼き', '生姜焼き', 'しょうが焼き'], kcal: 450, p: 26, f: 28, c: 18, serving: '1人前' },
  { name: 'ハンバーグ', keywords: ['ハンバーグ'], kcal: 520, p: 27, f: 35, c: 20, serving: '1個' },
  { name: '焼き魚', keywords: ['鮭の塩焼き', 'さばの塩焼き', 'サバの塩焼き', '焼き魚', '焼鮭', 'ほっけ'], kcal: 250, p: 28, f: 14, c: 1, serving: '1切れ' },
  { name: '天ぷら', keywords: ['天ぷら', '天婦羅', 'てんぷら'], kcal: 500, p: 15, f: 30, c: 40, serving: '1人前' },
  { name: 'エビフライ', keywords: ['エビフライ', '海老フライ', 'えびフライ'], kcal: 350, p: 18, f: 20, c: 25, serving: '2本' },
  { name: 'コロッケ', keywords: ['コロッケ'], kcal: 300, p: 6, f: 16, c: 32, serving: '2個' },
  { name: '餃子', keywords: ['餃子', 'ぎょうざ', 'ギョーザ'], kcal: 350, p: 14, f: 18, c: 35, serving: '6個' },
  { name: '焼売', keywords: ['焼売', 'シュウマイ', 'シューマイ'], kcal: 250, p: 12, f: 14, c: 18, serving: '6個' },
  { name: '春巻き', keywords: ['春巻き', '春巻'], kcal: 300, p: 8, f: 18, c: 28, serving: '2本' },
  { name: '麻婆豆腐', keywords: ['麻婆豆腐', 'マーボー豆腐', 'マーボーどうふ'], kcal: 350, p: 18, f: 22, c: 18, serving: '1人前' },
  { name: '酢豚', keywords: ['酢豚'], kcal: 480, p: 20, f: 25, c: 40, serving: '1人前' },
  { name: '回鍋肉', keywords: ['回鍋肉', 'ホイコーロー'], kcal: 400, p: 20, f: 28, c: 18, serving: '1人前' },
  { name: '青椒肉絲', keywords: ['青椒肉絲', 'チンジャオロース'], kcal: 320, p: 20, f: 20, c: 15, serving: '1人前' },
  { name: 'エビチリ', keywords: ['エビチリ', '海老チリ', 'えびチリ'], kcal: 280, p: 22, f: 14, c: 18, serving: '1人前' },
  { name: '焼肉', keywords: ['焼肉', '焼き肉', 'カルビ', 'ハラミ'], kcal: 600, p: 35, f: 45, c: 10, serving: '1人前' },
  { name: 'ステーキ', keywords: ['ステーキ', 'ビーフステーキ'], kcal: 550, p: 40, f: 40, c: 5, serving: '1枚' },

  // ── 鍋・煮込み・洋食 ──
  { name: 'すき焼き', keywords: ['すき焼き', 'すきやき'], kcal: 600, p: 32, f: 35, c: 35, serving: '1人前' },
  { name: '鍋', keywords: ['寄せ鍋', '水炊き', 'しゃぶしゃぶ', 'もつ鍋', '鍋'], kcal: 500, p: 35, f: 25, c: 25, serving: '1人前' },
  { name: 'シチュー', keywords: ['ビーフシチュー', 'クリームシチュー', 'シチュー'], kcal: 350, p: 15, f: 18, c: 35, serving: '1皿' },
  { name: 'グラタン', keywords: ['グラタン', 'ドリア'], kcal: 500, p: 18, f: 25, c: 50, serving: '1皿' },
  { name: 'お好み焼き', keywords: ['お好み焼き', 'おこのみやき', 'モダン焼き', '豚玉'], kcal: 600, p: 22, f: 30, c: 60, serving: '1枚' },
  { name: 'たこ焼き', keywords: ['たこ焼き', 'タコ焼き', 'たこやき'], kcal: 350, p: 12, f: 15, c: 42, serving: '8個' },
  { name: 'もんじゃ焼き', keywords: ['もんじゃ焼き', 'もんじゃ'], kcal: 400, p: 15, f: 18, c: 45, serving: '1人前' },

  // ── パン・卵・軽食 ──
  { name: 'ハンバーガー', keywords: ['チーズバーガー', 'ベーコンバーガー', 'ハンバーガー', 'バーガー'], kcal: 500, p: 25, f: 25, c: 45, serving: '1個' },
  { name: 'ピザ', keywords: ['マルゲリータ', 'ピザ', 'ピッツァ'], kcal: 540, p: 22, f: 20, c: 65, serving: '2切れ' },
  { name: 'サンドイッチ', keywords: ['サンドイッチ', 'サンドウィッチ', 'サンド'], kcal: 350, p: 14, f: 16, c: 38, serving: '1人前' },
  { name: 'トースト', keywords: ['トースト', '食パン'], kcal: 200, p: 6, f: 5, c: 32, serving: '1枚' },
  { name: 'パンケーキ', keywords: ['パンケーキ', 'ホットケーキ'], kcal: 500, p: 12, f: 18, c: 72, serving: '2枚' },
  { name: 'フライドポテト', keywords: ['フライドポテト', 'フレンチフライ', 'ポテト'], kcal: 320, p: 4, f: 16, c: 40, serving: 'Mサイズ' },
  { name: '目玉焼き', keywords: ['目玉焼き'], kcal: 90, p: 6, f: 7, c: 0.5, serving: '1個' },
  { name: 'オムレツ', keywords: ['オムレツ'], kcal: 250, p: 14, f: 20, c: 3, serving: '1人前' },
  { name: '卵焼き', keywords: ['卵焼き', '玉子焼き', 'だし巻き卵'], kcal: 150, p: 10, f: 10, c: 5, serving: '1人前' },
  { name: 'サラダチキン', keywords: ['サラダチキン'], kcal: 110, p: 23, f: 1.5, c: 0.5, serving: '1個' },

  // ── 汁物・副菜 ──
  { name: '味噌汁', keywords: ['味噌汁', 'みそ汁', 'お味噌汁'], kcal: 60, p: 4, f: 2, c: 7, serving: '1杯' },
  { name: '豚汁', keywords: ['豚汁', 'とん汁'], kcal: 200, p: 10, f: 10, c: 18, serving: '1杯' },
  { name: 'サラダ', keywords: ['ミックスサラダ', '野菜サラダ', 'グリーンサラダ', 'サラダ'], kcal: 80, p: 3, f: 5, c: 7, serving: '1皿' },
  { name: 'シーザーサラダ', keywords: ['シーザーサラダ'], kcal: 180, p: 6, f: 14, c: 8, serving: '1皿' },
  { name: '冷奴', keywords: ['冷奴', '冷ややっこ', '湯豆腐'], kcal: 90, p: 8, f: 5, c: 3, serving: '1人前' },
  { name: '枝豆', keywords: ['枝豆', 'えだまめ'], kcal: 120, p: 11, f: 5, c: 9, serving: '1人前' },
  { name: '納豆', keywords: ['納豆'], kcal: 100, p: 8, f: 5, c: 7, serving: '1パック' },

  // ── デザート・間食 ──
  { name: 'ケーキ', keywords: ['ショートケーキ', 'チーズケーキ', 'ケーキ'], kcal: 350, p: 5, f: 20, c: 38, serving: '1切れ' },
  { name: 'アイスクリーム', keywords: ['アイスクリーム', 'アイス', 'ソフトクリーム'], kcal: 200, p: 3.5, f: 12, c: 20, serving: '1個' },
  { name: 'プリン', keywords: ['プリン', 'プディング'], kcal: 150, p: 4, f: 6, c: 22, serving: '1個' },
  { name: 'ドーナツ', keywords: ['ドーナツ', 'ドーナッツ'], kcal: 250, p: 4, f: 14, c: 28, serving: '1個' },
  { name: 'チョコレート', keywords: ['チョコレート', 'チョコ'], kcal: 280, p: 3, f: 18, c: 28, serving: '板1/2枚' },
  { name: 'ポテトチップス', keywords: ['ポテトチップス', 'ポテチ'], kcal: 340, p: 3, f: 22, c: 33, serving: '60g' },
  { name: 'ヨーグルト', keywords: ['ヨーグルト'], kcal: 100, p: 5, f: 3, c: 14, serving: '1個' },
  { name: 'バナナ', keywords: ['バナナ'], kcal: 90, p: 1, f: 0.2, c: 23, serving: '1本' },
  { name: 'りんご', keywords: ['りんご', 'リンゴ', '林檎'], kcal: 110, p: 0.4, f: 0.3, c: 29, serving: '1個' },

  // ── ドリンク ──
  { name: 'カフェラテ', keywords: ['カフェラテ', 'カフェオレ', 'ラテ'], kcal: 110, p: 6, f: 6, c: 9, serving: '1杯' },
  { name: 'コーヒー', keywords: ['ブラックコーヒー', 'コーヒー'], kcal: 10, p: 0.5, f: 0, c: 1.5, serving: '1杯' },
  { name: 'オレンジジュース', keywords: ['オレンジジュース'], kcal: 90, p: 1, f: 0, c: 21, serving: '1杯' },
  { name: 'コーラ', keywords: ['コーラ', 'コカコーラ'], kcal: 140, p: 0, f: 0, c: 35, serving: '350ml' },
  { name: '牛乳', keywords: ['牛乳', 'ミルク'], kcal: 130, p: 6.6, f: 7.6, c: 9.6, serving: '200ml' },
  { name: 'ビール', keywords: ['ビール'], kcal: 150, p: 1.6, f: 0, c: 11, serving: '350ml' },
];

/** マッチング用に表記ゆれを吸収して正規化する。 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s　・、,，.．。!！?？]/g, '')
    .trim();
}

/**
 * 料理名から栄養エントリを引く。
 * クエリに含まれる（または含む）キーワードのうち、最も長く一致したものを採用する。
 */
export function lookupNutrition(name: string | null | undefined): NutritionEntry | null {
  if (!name) return null;
  const q = normalize(name);
  if (q.length < 2) return null;

  let best: NutritionEntry | null = null;
  let bestLen = 0;

  for (const entry of TABLE) {
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      if (k.length < 2) continue;
      // 双方向の部分一致（「カレー」⊂「ビーフカレー」/「カレーライス」⊃「カレー」）
      const matched = q.includes(k) || k.includes(q);
      if (matched && k.length > bestLen) {
        best = entry;
        bestLen = k.length;
      }
    }
  }
  return best;
}

/**
 * 料理名のクエリにマッチする料理を複数返す（食事名入力のサジェスト用）。
 * キーワードの双方向部分一致＋名前一致で拾い、重複（同一料理）は除く。
 */
export function searchDishes(query: string, limit = 6): NutritionEntry[] {
  const q = normalize(query);
  if (q.length < 1) return [];

  const out: NutritionEntry[] = [];
  const seen = new Set<string>();
  for (const entry of TABLE) {
    if (out.length >= limit) break;
    if (seen.has(entry.name)) continue;
    const nameKey = normalize(entry.name);
    const hit =
      nameKey.includes(q) ||
      entry.keywords.some((kw) => {
        const k = normalize(kw);
        return k.length >= 1 && (k.includes(q) || q.includes(k));
      });
    if (hit) { out.push(entry); seen.add(entry.name); }
  }
  return out;
}

function portionFactor(portion?: string | null): number {
  switch ((portion ?? '').toLowerCase()) {
    case 'small': return 0.7;
    case 'large': return 1.4;
    default: return 1.0;
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * AI解析結果のカロリー/PFCを、栄養DBにヒットした場合は決定的な値で置き換える。
 * - dishName と candidates の順にDBを検索し、最初にヒットしたものを採用。
 * - 分量(portion)で標準値をスケールする。
 * - DB非ヒットならAIの推定値をそのまま使う（source で区別）。
 */
export function applyNutritionDb(
  result: MealAnalysisResult,
  portion?: string | null,
): MealAnalysisResult {
  const names = [result.dishName, ...(result.candidates ?? [])].filter(
    (n): n is string => typeof n === 'string' && n.trim() !== '',
  );

  let entry: NutritionEntry | null = null;
  for (const n of names) {
    entry = lookupNutrition(n);
    if (entry) break;
  }

  if (!entry) {
    // DB非ヒット: AIの数値があれば 'ai'、無ければ source なし（フォールバック相当）
    return { ...result, source: result.estimatedCalories !== null ? 'ai' : null };
  }

  const factor = portionFactor(portion);
  return {
    ...result,
    estimatedCalories: Math.round(entry.kcal * factor),
    protein: round1(entry.p * factor),
    fat: round1(entry.f * factor),
    carbs: round1(entry.c * factor),
    source: 'db',
    matchedFood: entry.name,
    servingLabel: entry.serving,
  };
}
