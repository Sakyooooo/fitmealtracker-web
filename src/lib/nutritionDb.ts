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

// 注: マッチは次の優先順で採用する（lookupNutrition 参照）。
//   ① 完全一致（「カレー」→ カレーライス、「ラーメン」→ ラーメン）
//   ② クエリに含まれるキーワードのうち最長（「とんかつ定食」→ とんかつ定食）
//   ③ ②が無ければ、クエリを含むキーワードのうち最短（断片入力のフォールバック）
// これにより「ボリュームカレー」等の長い商品名を足しても「カレー」が乗っ取られない。
const TABLE: NutritionEntry[] = [
  // ── ご飯・丼もの ──
  { name: '白米ごはん', keywords: ['白米', '白ごはん', '白ご飯', 'ごはん', 'ご飯'], kcal: 252, p: 3.8, f: 0.5, c: 55, serving: '茶碗1杯(150g)' },
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

  // ── ご飯・丼もの（追加） ──
  { name: '中華丼', keywords: ['中華丼'], kcal: 600, p: 20, f: 18, c: 85, serving: '1杯' },
  { name: '天津飯', keywords: ['天津飯', '天津丼'], kcal: 650, p: 20, f: 22, c: 85, serving: '1杯' },
  { name: 'ハヤシライス', keywords: ['ハヤシライス', 'ハッシュドビーフ'], kcal: 650, p: 15, f: 20, c: 95, serving: '1皿' },
  { name: 'ドライカレー', keywords: ['ドライカレー', 'キーマカレー'], kcal: 620, p: 17, f: 20, c: 88, serving: '1皿' },
  { name: 'タコライス', keywords: ['タコライス'], kcal: 650, p: 22, f: 25, c: 80, serving: '1皿' },
  { name: 'ロコモコ', keywords: ['ロコモコ'], kcal: 700, p: 25, f: 30, c: 80, serving: '1皿' },
  { name: 'ガパオライス', keywords: ['ガパオライス', 'ガパオ'], kcal: 650, p: 24, f: 24, c: 80, serving: '1皿' },
  { name: 'うな重', keywords: ['うな重', 'うな丼', 'うなぎ', '鰻'], kcal: 750, p: 30, f: 30, c: 95, serving: '1人前' },
  { name: 'ねぎとろ丼', keywords: ['ねぎとろ丼', 'ネギトロ丼'], kcal: 480, p: 22, f: 12, c: 75, serving: '1杯' },
  { name: 'そぼろ丼', keywords: ['そぼろ丼', '三色丼', 'そぼろ弁当'], kcal: 600, p: 24, f: 15, c: 85, serving: '1杯' },
  { name: 'チキンライス', keywords: ['チキンライス'], kcal: 600, p: 18, f: 18, c: 85, serving: '1皿' },
  { name: 'いなり寿司', keywords: ['いなり寿司', 'いなり', 'おいなりさん'], kcal: 350, p: 8, f: 6, c: 65, serving: '3個' },
  { name: 'ちらし寿司', keywords: ['ちらし寿司', 'ばらちらし', '五目ちらし'], kcal: 500, p: 20, f: 8, c: 85, serving: '1人前' },
  { name: '巻き寿司', keywords: ['巻き寿司', '太巻き', '恵方巻', 'のり巻き'], kcal: 350, p: 10, f: 5, c: 65, serving: '1本' },
  { name: '雑炊', keywords: ['雑炊', 'おじや'], kcal: 250, p: 10, f: 3, c: 45, serving: '1杯' },
  { name: 'お茶漬け', keywords: ['お茶漬け', '茶漬け', 'お茶づけ'], kcal: 180, p: 5, f: 1, c: 38, serving: '1杯' },
  { name: 'おかゆ', keywords: ['おかゆ', 'お粥', '粥'], kcal: 150, p: 3, f: 0.3, c: 33, serving: '1杯' },
  { name: '赤飯', keywords: ['赤飯', 'お赤飯'], kcal: 280, p: 6, f: 1, c: 60, serving: '1膳' },
  { name: '炊き込みご飯', keywords: ['炊き込みご飯', '炊き込みごはん', '釜飯', '五目ごはん'], kcal: 450, p: 16, f: 8, c: 80, serving: '1人前' },
  { name: '焼きおにぎり', keywords: ['焼きおにぎり', '焼おにぎり'], kcal: 180, p: 3, f: 1, c: 39, serving: '1個' },

  // ── 麺類（追加） ──
  { name: '冷やし中華', keywords: ['冷やし中華', '冷し中華'], kcal: 500, p: 18, f: 15, c: 70, serving: '1人前' },
  { name: 'ちゃんぽん', keywords: ['ちゃんぽん', 'チャンポン'], kcal: 600, p: 25, f: 20, c: 75, serving: '1杯' },
  { name: '油そば', keywords: ['油そば', 'まぜそば', '混ぜそば'], kcal: 650, p: 22, f: 22, c: 90, serving: '1杯' },
  { name: '焼きうどん', keywords: ['焼きうどん', 'やきうどん'], kcal: 480, p: 14, f: 15, c: 70, serving: '1人前' },
  { name: 'カレーうどん', keywords: ['カレーうどん', 'カレーそば'], kcal: 500, p: 15, f: 15, c: 75, serving: '1杯' },
  { name: '鍋焼きうどん', keywords: ['鍋焼きうどん', '鍋焼うどん'], kcal: 500, p: 20, f: 12, c: 75, serving: '1人前' },
  { name: '肉うどん', keywords: ['肉うどん'], kcal: 450, p: 18, f: 10, c: 72, serving: '1杯' },
  { name: 'きつねうどん', keywords: ['きつねうどん', 'たぬきうどん', 'きつねそば'], kcal: 400, p: 13, f: 8, c: 70, serving: '1杯' },
  { name: '冷麺', keywords: ['冷麺', '韓国冷麺', 'れいめん'], kcal: 450, p: 15, f: 8, c: 80, serving: '1杯' },
  { name: 'フォー', keywords: ['フォー'], kcal: 400, p: 18, f: 6, c: 70, serving: '1杯' },
  { name: 'パッタイ', keywords: ['パッタイ'], kcal: 550, p: 18, f: 18, c: 80, serving: '1人前' },
  { name: 'ビーフン', keywords: ['ビーフン', '焼きビーフン'], kcal: 400, p: 12, f: 12, c: 62, serving: '1人前' },
  { name: '沖縄そば', keywords: ['沖縄そば', 'ソーキそば'], kcal: 500, p: 20, f: 15, c: 70, serving: '1杯' },

  // ── 主菜・おかず（追加） ──
  { name: 'チキン南蛮', keywords: ['チキン南蛮', 'チキンなんばん'], kcal: 700, p: 35, f: 40, c: 45, serving: '1人前' },
  { name: '肉じゃが', keywords: ['肉じゃが'], kcal: 350, p: 12, f: 12, c: 45, serving: '1人前' },
  { name: 'ぶり大根', keywords: ['ぶり大根', 'ブリ大根'], kcal: 350, p: 25, f: 15, c: 20, serving: '1人前' },
  { name: '照り焼きチキン', keywords: ['照り焼きチキン', '鶏の照り焼き', 'てりやきチキン', '照り焼き'], kcal: 380, p: 28, f: 22, c: 12, serving: '1人前' },
  { name: 'さばの味噌煮', keywords: ['さばの味噌煮', 'サバの味噌煮', '鯖の味噌煮'], kcal: 320, p: 24, f: 18, c: 12, serving: '1切れ' },
  { name: 'ローストビーフ', keywords: ['ローストビーフ'], kcal: 250, p: 28, f: 14, c: 2, serving: '1人前' },
  { name: 'ロールキャベツ', keywords: ['ロールキャベツ'], kcal: 250, p: 14, f: 14, c: 16, serving: '2個' },
  { name: 'メンチカツ', keywords: ['メンチカツ'], kcal: 350, p: 14, f: 24, c: 22, serving: '1個' },
  { name: '串カツ', keywords: ['串カツ', '串揚げ'], kcal: 400, p: 16, f: 24, c: 30, serving: '5本' },
  { name: '焼き鳥', keywords: ['焼き鳥', '焼鳥', 'やきとり', '串焼き'], kcal: 320, p: 28, f: 20, c: 8, serving: '5本' },
  { name: 'つくね', keywords: ['つくね'], kcal: 280, p: 18, f: 18, c: 10, serving: '3本' },
  { name: 'ローストチキン', keywords: ['ローストチキン', 'グリルチキン'], kcal: 400, p: 35, f: 26, c: 5, serving: '1人前' },
  { name: 'フライドチキン', keywords: ['フライドチキン', 'ケンタッキー'], kcal: 300, p: 18, f: 18, c: 12, serving: '2ピース' },
  { name: 'チキンナゲット', keywords: ['チキンナゲット', 'ナゲット'], kcal: 270, p: 14, f: 17, c: 16, serving: '5個' },
  { name: '麻婆茄子', keywords: ['麻婆茄子', 'マーボーナス', '麻婆なす'], kcal: 320, p: 12, f: 22, c: 20, serving: '1人前' },
  { name: '八宝菜', keywords: ['八宝菜'], kcal: 280, p: 16, f: 16, c: 18, serving: '1人前' },
  { name: 'レバニラ炒め', keywords: ['レバニラ', 'レバニラ炒め'], kcal: 320, p: 22, f: 18, c: 16, serving: '1人前' },
  { name: 'ニラ玉', keywords: ['ニラ玉', 'にら玉'], kcal: 220, p: 12, f: 16, c: 6, serving: '1人前' },
  { name: '豚の角煮', keywords: ['豚の角煮', '角煮'], kcal: 450, p: 22, f: 32, c: 10, serving: '1人前' },
  { name: 'モツ煮', keywords: ['モツ煮', 'もつ煮込み', 'もつ煮'], kcal: 300, p: 18, f: 18, c: 12, serving: '1人前' },
  { name: 'チャプチェ', keywords: ['チャプチェ'], kcal: 350, p: 10, f: 12, c: 50, serving: '1人前' },
  { name: 'プルコギ', keywords: ['プルコギ'], kcal: 400, p: 24, f: 22, c: 22, serving: '1人前' },
  { name: 'サムギョプサル', keywords: ['サムギョプサル'], kcal: 550, p: 30, f: 44, c: 5, serving: '1人前' },
  { name: 'スンドゥブ', keywords: ['スンドゥブ', '純豆腐', 'スンドゥブチゲ'], kcal: 300, p: 20, f: 16, c: 14, serving: '1人前' },
  { name: 'タッカルビ', keywords: ['タッカルビ', 'チーズタッカルビ'], kcal: 500, p: 30, f: 26, c: 30, serving: '1人前' },
  { name: 'チヂミ', keywords: ['チヂミ', 'ジョン'], kcal: 350, p: 10, f: 16, c: 40, serving: '1枚' },
  { name: 'キムチ', keywords: ['キムチ'], kcal: 30, p: 1.5, f: 0.3, c: 5, serving: '小鉢' },

  // ── 洋食・軽食（追加） ──
  { name: 'ラザニア', keywords: ['ラザニア'], kcal: 500, p: 22, f: 26, c: 45, serving: '1人前' },
  { name: 'リゾット', keywords: ['リゾット'], kcal: 450, p: 14, f: 16, c: 60, serving: '1皿' },
  { name: 'パエリア', keywords: ['パエリア', 'パエージャ'], kcal: 550, p: 22, f: 16, c: 80, serving: '1人前' },
  { name: 'タコス', keywords: ['タコス'], kcal: 400, p: 16, f: 20, c: 40, serving: '2個' },
  { name: 'ブリトー', keywords: ['ブリトー'], kcal: 500, p: 18, f: 22, c: 55, serving: '1個' },
  { name: 'ケバブ', keywords: ['ケバブ', 'ドネルケバブ'], kcal: 450, p: 25, f: 24, c: 35, serving: '1個' },
  { name: 'ホットドッグ', keywords: ['ホットドッグ', 'ホットドック'], kcal: 320, p: 12, f: 18, c: 28, serving: '1本' },
  { name: 'アメリカンドッグ', keywords: ['アメリカンドッグ', 'アメリカンドック'], kcal: 280, p: 7, f: 15, c: 30, serving: '1本' },
  { name: 'クラムチャウダー', keywords: ['クラムチャウダー'], kcal: 200, p: 9, f: 10, c: 20, serving: '1杯' },
  { name: 'ミネストローネ', keywords: ['ミネストローネ'], kcal: 130, p: 5, f: 4, c: 18, serving: '1杯' },
  { name: 'コーンスープ', keywords: ['コーンスープ', 'コーンポタージュ', 'ポタージュ'], kcal: 150, p: 4, f: 6, c: 20, serving: '1杯' },
  { name: 'カレーパン', keywords: ['カレーパン'], kcal: 320, p: 7, f: 18, c: 33, serving: '1個' },
  { name: 'メロンパン', keywords: ['メロンパン'], kcal: 350, p: 7, f: 12, c: 52, serving: '1個' },
  { name: 'クロワッサン', keywords: ['クロワッサン'], kcal: 230, p: 5, f: 14, c: 22, serving: '1個' },
  { name: 'あんぱん', keywords: ['あんぱん', 'あんパン'], kcal: 280, p: 7, f: 5, c: 52, serving: '1個' },
  { name: '焼きそばパン', keywords: ['焼きそばパン'], kcal: 350, p: 9, f: 14, c: 48, serving: '1個' },
  { name: 'フレンチトースト', keywords: ['フレンチトースト'], kcal: 350, p: 10, f: 16, c: 42, serving: '1人前' },
  { name: 'エッグベネディクト', keywords: ['エッグベネディクト'], kcal: 400, p: 18, f: 26, c: 25, serving: '1人前' },
  { name: 'ワッフル', keywords: ['ワッフル'], kcal: 300, p: 6, f: 14, c: 38, serving: '1個' },
  { name: 'グラノーラ', keywords: ['グラノーラ', 'シリアル', 'コーンフレーク'], kcal: 250, p: 6, f: 8, c: 40, serving: '1食' },
  { name: 'オートミール', keywords: ['オートミール', 'オーツ'], kcal: 150, p: 5, f: 3, c: 27, serving: '1食' },
  { name: 'ベーグル', keywords: ['ベーグル'], kcal: 270, p: 9, f: 2, c: 54, serving: '1個' },

  // ── 卵・朝食（追加） ──
  { name: 'ベーコンエッグ', keywords: ['ベーコンエッグ', 'ハムエッグ'], kcal: 250, p: 14, f: 20, c: 1, serving: '1人前' },
  { name: 'スクランブルエッグ', keywords: ['スクランブルエッグ'], kcal: 200, p: 12, f: 16, c: 2, serving: '1人前' },
  { name: 'ゆで卵', keywords: ['ゆで卵', '茹で卵', 'ゆでたまご'], kcal: 80, p: 6.5, f: 5.5, c: 0.3, serving: '1個' },
  { name: '温泉卵', keywords: ['温泉卵', '温玉'], kcal: 80, p: 6.5, f: 5.5, c: 0.3, serving: '1個' },
  { name: '卵かけご飯', keywords: ['卵かけご飯', 'たまごかけごはん', 'TKG'], kcal: 320, p: 10, f: 6, c: 55, serving: '1杯' },
  { name: '納豆ご飯', keywords: ['納豆ご飯', '納豆ごはん'], kcal: 290, p: 12, f: 6, c: 52, serving: '1杯' },

  // ── 和の副菜・汁物（追加） ──
  { name: 'ひじき煮', keywords: ['ひじき煮', 'ひじきの煮物', 'ひじき'], kcal: 100, p: 3, f: 5, c: 12, serving: '小鉢' },
  { name: 'きんぴらごぼう', keywords: ['きんぴらごぼう', 'きんぴら'], kcal: 120, p: 2, f: 6, c: 15, serving: '小鉢' },
  { name: '切り干し大根', keywords: ['切り干し大根', '切干大根'], kcal: 90, p: 2, f: 3, c: 14, serving: '小鉢' },
  { name: 'おひたし', keywords: ['おひたし', 'ほうれん草のおひたし'], kcal: 40, p: 3, f: 0.5, c: 5, serving: '小鉢' },
  { name: '茶碗蒸し', keywords: ['茶碗蒸し', '茶碗蒸'], kcal: 100, p: 8, f: 4, c: 6, serving: '1個' },
  { name: 'おでん', keywords: ['おでん'], kcal: 300, p: 20, f: 12, c: 28, serving: '1人前' },
  { name: '厚揚げ', keywords: ['厚揚げ', '焼き厚揚げ', 'がんもどき'], kcal: 150, p: 11, f: 11, c: 2, serving: '1枚' },
  { name: '漬物', keywords: ['漬物', 'お新香', '浅漬け'], kcal: 20, p: 1, f: 0.1, c: 4, serving: '小鉢' },
  { name: 'けんちん汁', keywords: ['けんちん汁'], kcal: 130, p: 6, f: 6, c: 14, serving: '1杯' },
  { name: 'わかめスープ', keywords: ['わかめスープ', '春雨スープ'], kcal: 80, p: 2, f: 2, c: 14, serving: '1杯' },
  { name: '小籠包', keywords: ['小籠包', 'ショウロンポウ', 'しょうろんぽう'], kcal: 220, p: 11, f: 10, c: 20, serving: '4個' },
  { name: '肉まん', keywords: ['肉まん', '豚まん', '中華まん'], kcal: 250, p: 9, f: 8, c: 36, serving: '1個' },
  { name: 'あんまん', keywords: ['あんまん'], kcal: 280, p: 6, f: 6, c: 50, serving: '1個' },

  // ── 和菓子・デザート（追加） ──
  { name: '大福', keywords: ['大福', '苺大福', 'いちご大福'], kcal: 200, p: 3, f: 0.5, c: 45, serving: '1個' },
  { name: 'どら焼き', keywords: ['どら焼き', 'どらやき'], kcal: 230, p: 5, f: 3, c: 48, serving: '1個' },
  { name: 'たい焼き', keywords: ['たい焼き', '鯛焼き', '今川焼き', '大判焼き'], kcal: 200, p: 4, f: 2, c: 43, serving: '1個' },
  { name: '団子', keywords: ['団子', 'みたらし団子', 'だんご'], kcal: 180, p: 3, f: 0.5, c: 40, serving: '1本' },
  { name: 'ようかん', keywords: ['ようかん', '羊羹'], kcal: 170, p: 2, f: 0.1, c: 40, serving: '1切れ' },
  { name: 'わらび餅', keywords: ['わらび餅', 'わらびもち'], kcal: 160, p: 1, f: 0.2, c: 38, serving: '1人前' },
  { name: 'パフェ', keywords: ['パフェ'], kcal: 450, p: 7, f: 22, c: 58, serving: '1個' },
  { name: 'クレープ', keywords: ['クレープ'], kcal: 350, p: 6, f: 16, c: 45, serving: '1個' },
  { name: 'シュークリーム', keywords: ['シュークリーム'], kcal: 220, p: 5, f: 13, c: 22, serving: '1個' },
  { name: 'マカロン', keywords: ['マカロン'], kcal: 100, p: 2, f: 5, c: 13, serving: '1個' },
  { name: 'クッキー', keywords: ['クッキー', 'ビスケット'], kcal: 180, p: 2, f: 9, c: 22, serving: '3枚' },
  { name: 'せんべい', keywords: ['せんべい', '煎餅', 'おかき'], kcal: 90, p: 1.5, f: 0.5, c: 20, serving: '2枚' },
  { name: 'スコーン', keywords: ['スコーン'], kcal: 280, p: 5, f: 13, c: 36, serving: '1個' },
  { name: 'ティラミス', keywords: ['ティラミス'], kcal: 300, p: 6, f: 20, c: 25, serving: '1個' },
  { name: 'モンブラン', keywords: ['モンブラン'], kcal: 350, p: 5, f: 20, c: 38, serving: '1個' },
  { name: 'ゼリー', keywords: ['ゼリー'], kcal: 90, p: 2, f: 0, c: 20, serving: '1個' },
  { name: '杏仁豆腐', keywords: ['杏仁豆腐'], kcal: 130, p: 3, f: 5, c: 18, serving: '1個' },
  { name: 'ポップコーン', keywords: ['ポップコーン'], kcal: 150, p: 3, f: 8, c: 18, serving: '1袋' },

  // ── 果物（追加） ──
  { name: 'みかん', keywords: ['みかん', 'ミカン', '蜜柑'], kcal: 45, p: 0.7, f: 0.1, c: 11, serving: '1個' },
  { name: 'ぶどう', keywords: ['ぶどう', 'ブドウ', '葡萄', 'マスカット'], kcal: 60, p: 0.4, f: 0.1, c: 15, serving: '1/2房' },
  { name: 'いちご', keywords: ['いちご', 'イチゴ', '苺'], kcal: 35, p: 0.9, f: 0.1, c: 8, serving: '5粒' },
  { name: 'メロン', keywords: ['メロン'], kcal: 60, p: 1, f: 0.1, c: 15, serving: '1/8個' },
  { name: 'スイカ', keywords: ['スイカ', 'すいか', '西瓜'], kcal: 50, p: 0.6, f: 0.1, c: 12, serving: '1切れ' },
  { name: 'パイナップル', keywords: ['パイナップル', 'パイン'], kcal: 55, p: 0.6, f: 0.1, c: 14, serving: '1人前' },
  { name: 'キウイ', keywords: ['キウイ'], kcal: 50, p: 1, f: 0.1, c: 13, serving: '1個' },
  { name: '桃', keywords: ['桃', 'ピーチ'], kcal: 60, p: 0.6, f: 0.1, c: 15, serving: '1個' },
  { name: '梨', keywords: ['梨', '洋梨'], kcal: 60, p: 0.3, f: 0.1, c: 15, serving: '1/2個' },
  { name: '柿', keywords: ['柿'], kcal: 90, p: 0.4, f: 0.2, c: 24, serving: '1個' },
  { name: 'ミックスナッツ', keywords: ['ミックスナッツ', 'ナッツ', 'アーモンド'], kcal: 180, p: 6, f: 16, c: 6, serving: '30g' },
  { name: '焼き芋', keywords: ['焼き芋', 'やきいも', '干し芋', 'さつまいも'], kcal: 230, p: 2.5, f: 0.5, c: 55, serving: '1本' },

  // ── ドリンク（追加） ──
  { name: '緑茶', keywords: ['緑茶', '煎茶', 'お茶'], kcal: 3, p: 0.3, f: 0, c: 0.5, serving: '1杯' },
  { name: '麦茶', keywords: ['麦茶'], kcal: 2, p: 0, f: 0, c: 0.4, serving: '1杯' },
  { name: '紅茶', keywords: ['紅茶', 'ストレートティー'], kcal: 5, p: 0.1, f: 0, c: 1, serving: '1杯' },
  { name: 'ウーロン茶', keywords: ['ウーロン茶', '烏龍茶'], kcal: 3, p: 0, f: 0, c: 0.5, serving: '1杯' },
  { name: '抹茶ラテ', keywords: ['抹茶ラテ', '抹茶オレ'], kcal: 180, p: 6, f: 6, c: 26, serving: '1杯' },
  { name: 'ミルクティー', keywords: ['ミルクティー', 'ロイヤルミルクティー'], kcal: 130, p: 4, f: 4, c: 20, serving: '1杯' },
  { name: 'タピオカミルクティー', keywords: ['タピオカ', 'タピオカミルクティー'], kcal: 280, p: 4, f: 6, c: 52, serving: '1杯' },
  { name: 'スムージー', keywords: ['スムージー', 'フルーツスムージー'], kcal: 180, p: 3, f: 1, c: 40, serving: '1杯' },
  { name: '野菜ジュース', keywords: ['野菜ジュース'], kcal: 70, p: 2, f: 0, c: 16, serving: '1本' },
  { name: 'りんごジュース', keywords: ['りんごジュース', 'アップルジュース'], kcal: 90, p: 0.2, f: 0, c: 22, serving: '1杯' },
  { name: 'エナジードリンク', keywords: ['エナジードリンク', 'レッドブル', 'モンスター'], kcal: 110, p: 0, f: 0, c: 28, serving: '1本' },
  { name: 'スポーツドリンク', keywords: ['スポーツドリンク', 'ポカリ', 'アクエリアス'], kcal: 100, p: 0, f: 0, c: 25, serving: '500ml' },
  { name: '豆乳', keywords: ['豆乳'], kcal: 110, p: 7, f: 4, c: 10, serving: '200ml' },
  { name: 'ココア', keywords: ['ココア', 'ホットチョコレート'], kcal: 200, p: 6, f: 8, c: 28, serving: '1杯' },
  { name: '甘酒', keywords: ['甘酒'], kcal: 130, p: 2, f: 0.2, c: 28, serving: '1杯' },
  { name: 'カルピス', keywords: ['カルピス'], kcal: 100, p: 1.5, f: 0, c: 23, serving: '1杯' },
  { name: 'サイダー', keywords: ['サイダー', 'ラムネ', '炭酸飲料'], kcal: 130, p: 0, f: 0, c: 33, serving: '350ml' },
  { name: 'プロテイン', keywords: ['プロテイン', 'プロテインシェイク'], kcal: 120, p: 24, f: 1.5, c: 3, serving: '1杯' },
  { name: 'ハイボール', keywords: ['ハイボール'], kcal: 140, p: 0, f: 0, c: 0, serving: '1杯' },
  { name: 'レモンサワー', keywords: ['レモンサワー', 'チューハイ', 'サワー'], kcal: 120, p: 0, f: 0, c: 10, serving: '1杯' },
  { name: 'ワイン', keywords: ['ワイン', '赤ワイン', '白ワイン'], kcal: 110, p: 0.1, f: 0, c: 3, serving: 'グラス1杯' },
  { name: '日本酒', keywords: ['日本酒', '清酒'], kcal: 180, p: 0.7, f: 0, c: 8, serving: '1合' },
  { name: '焼酎', keywords: ['焼酎', '酎ハイ'], kcal: 145, p: 0, f: 0, c: 0, serving: '1杯' },

  // ══ コンビニ ══════════════════════════════════════════════════════════════════
  // ※ カロリー/PFCは公開情報を元にした概算（店舗・時期で変動）。修正前提の目安値。

  // ── ホットスナック ──
  { name: 'からあげクン', keywords: ['からあげクン', 'カラアゲクン'], kcal: 220, p: 13, f: 14, c: 10, serving: '1箱(5個)' },
  { name: 'ファミチキ', keywords: ['ファミチキ', 'ファミマチキン'], kcal: 250, p: 13, f: 16, c: 14, serving: '1個' },
  { name: 'Lチキ', keywords: ['Lチキ', 'エルチキン', 'ローソンチキン'], kcal: 320, p: 15, f: 18, c: 25, serving: '1個' },
  { name: 'ななチキ', keywords: ['ななチキ', 'ナナチキ'], kcal: 200, p: 13, f: 12, c: 9, serving: '1個' },
  { name: 'スパイシーチキン', keywords: ['スパイシーチキン', 'ホットチキン'], kcal: 230, p: 14, f: 13, c: 14, serving: '1個' },
  { name: 'フランクフルト', keywords: ['フランクフルト', 'フランク'], kcal: 280, p: 10, f: 24, c: 8, serving: '1本' },
  { name: 'ハッシュドポテト', keywords: ['ハッシュドポテト', 'ハッシュポテト'], kcal: 150, p: 1.5, f: 9, c: 15, serving: '1個' },
  { name: 'チーズドッグ', keywords: ['チーズドッグ', 'チーズハットグ', 'ハットグ'], kcal: 350, p: 9, f: 18, c: 38, serving: '1本' },

  // ── おにぎり ──
  { name: 'ツナマヨおにぎり', keywords: ['ツナマヨおにぎり', 'ツナマヨ', 'ツナマヨネーズ'], kcal: 230, p: 5, f: 7, c: 37, serving: '1個' },
  { name: '鮭おにぎり', keywords: ['鮭おにぎり', 'シャケおにぎり', '焼鮭おにぎり'], kcal: 180, p: 5, f: 2, c: 36, serving: '1個' },
  { name: '明太子おにぎり', keywords: ['明太子おにぎり', '明太おにぎり', 'たらこおにぎり', 'たらこ'], kcal: 175, p: 5, f: 1.5, c: 36, serving: '1個' },
  { name: '梅おにぎり', keywords: ['梅おにぎり', '梅干しおにぎり', '梅干し'], kcal: 170, p: 3, f: 0.5, c: 38, serving: '1個' },
  { name: '昆布おにぎり', keywords: ['昆布おにぎり', 'こんぶおにぎり'], kcal: 175, p: 3.5, f: 0.6, c: 38, serving: '1個' },
  { name: 'おかかおにぎり', keywords: ['おかかおにぎり', 'かつおおにぎり', 'おかか'], kcal: 175, p: 4, f: 0.8, c: 37, serving: '1個' },
  { name: '高菜おにぎり', keywords: ['高菜おにぎり', '高菜'], kcal: 180, p: 3.5, f: 1.5, c: 37, serving: '1個' },
  { name: 'から揚げおにぎり', keywords: ['から揚げおにぎり', '唐揚げおにぎり', 'チキンおにぎり'], kcal: 270, p: 8, f: 8, c: 40, serving: '1個' },
  { name: '五目おにぎり', keywords: ['五目おにぎり', '五目むすび', '混ぜご飯おにぎり'], kcal: 200, p: 4, f: 2, c: 42, serving: '1個' },
  { name: '天むす', keywords: ['天むす'], kcal: 200, p: 5, f: 4, c: 36, serving: '1個' },

  // ── サンドイッチ ──
  { name: 'たまごサンド', keywords: ['たまごサンド', '卵サンド', 'エッグサンド', '玉子サンド'], kcal: 340, p: 12, f: 20, c: 28, serving: '1パック' },
  { name: 'ツナサンド', keywords: ['ツナサンド'], kcal: 330, p: 11, f: 18, c: 30, serving: '1パック' },
  { name: 'ハムサンド', keywords: ['ハムサンド', 'ハムチーズサンド'], kcal: 300, p: 12, f: 15, c: 30, serving: '1パック' },
  { name: 'カツサンド', keywords: ['カツサンド'], kcal: 480, p: 18, f: 24, c: 45, serving: '1パック' },
  { name: 'BLTサンド', keywords: ['BLTサンド', 'BLT'], kcal: 350, p: 12, f: 20, c: 30, serving: '1パック' },
  { name: 'ミックスサンド', keywords: ['ミックスサンド'], kcal: 330, p: 12, f: 17, c: 32, serving: '1パック' },
  { name: '照り焼きチキンサンド', keywords: ['チキンサンド', '照り焼きチキンサンド'], kcal: 360, p: 16, f: 16, c: 35, serving: '1パック' },
  { name: 'フルーツサンド', keywords: ['フルーツサンド'], kcal: 320, p: 6, f: 14, c: 42, serving: '1パック' },

  // ── 菓子パン・惣菜パン ──
  { name: 'コッペパン', keywords: ['コッペパン'], kcal: 280, p: 8, f: 8, c: 44, serving: '1個' },
  { name: 'クリームパン', keywords: ['クリームパン'], kcal: 300, p: 7, f: 10, c: 45, serving: '1個' },
  { name: 'ジャムパン', keywords: ['ジャムパン'], kcal: 290, p: 6, f: 6, c: 52, serving: '1個' },
  { name: 'チョココロネ', keywords: ['チョココロネ', 'チョコパン'], kcal: 320, p: 6, f: 14, c: 42, serving: '1個' },
  { name: 'ソーセージパン', keywords: ['ソーセージパン', 'ウインナーパン'], kcal: 320, p: 10, f: 18, c: 30, serving: '1個' },
  { name: 'デニッシュ', keywords: ['デニッシュ'], kcal: 320, p: 6, f: 16, c: 38, serving: '1個' },
  { name: 'ピザトースト', keywords: ['ピザトースト'], kcal: 300, p: 12, f: 12, c: 35, serving: '1枚' },
  { name: '蒸しパン', keywords: ['蒸しパン', 'チーズ蒸しパン'], kcal: 230, p: 5, f: 5, c: 42, serving: '1個' },
  { name: 'ピザまん', keywords: ['ピザまん'], kcal: 230, p: 8, f: 8, c: 32, serving: '1個' },

  // ── 弁当・カップ麺 ──
  { name: 'からあげ弁当', keywords: ['からあげ弁当', '唐揚げ弁当'], kcal: 750, p: 28, f: 30, c: 90, serving: '1食' },
  { name: 'のり弁当', keywords: ['のり弁', 'のり弁当'], kcal: 700, p: 18, f: 22, c: 100, serving: '1食' },
  { name: 'ハンバーグ弁当', keywords: ['ハンバーグ弁当'], kcal: 800, p: 28, f: 32, c: 95, serving: '1食' },
  { name: '焼肉弁当', keywords: ['焼肉弁当'], kcal: 780, p: 26, f: 28, c: 100, serving: '1食' },
  { name: 'カップ麺', keywords: ['カップ麺', 'カップヌードル', 'カップラーメン'], kcal: 350, p: 9, f: 15, c: 48, serving: '1個' },
  { name: 'カップ焼きそば', keywords: ['カップ焼きそば', 'カップやきそば'], kcal: 540, p: 9, f: 20, c: 80, serving: '1個' },
  { name: 'カップうどん', keywords: ['カップうどん', 'どん兵衛'], kcal: 400, p: 9, f: 14, c: 58, serving: '1個' },
  { name: 'カップそば', keywords: ['カップそば'], kcal: 420, p: 10, f: 15, c: 60, serving: '1個' },

  // ── サラダ・惣菜 ──
  { name: 'ポテトサラダ', keywords: ['ポテトサラダ', 'ポテサラ'], kcal: 180, p: 3, f: 12, c: 16, serving: '1パック' },
  { name: 'マカロニサラダ', keywords: ['マカロニサラダ'], kcal: 200, p: 4, f: 12, c: 20, serving: '1パック' },
  { name: '春雨サラダ', keywords: ['春雨サラダ'], kcal: 120, p: 3, f: 4, c: 19, serving: '1パック' },
  { name: 'コールスロー', keywords: ['コールスロー'], kcal: 130, p: 1.5, f: 10, c: 9, serving: '1パック' },
  { name: '海藻サラダ', keywords: ['海藻サラダ', 'わかめサラダ'], kcal: 50, p: 2, f: 2, c: 7, serving: '1パック' },
  { name: '大根サラダ', keywords: ['大根サラダ'], kcal: 70, p: 1.5, f: 4, c: 8, serving: '1パック' },
  { name: 'ごぼうサラダ', keywords: ['ごぼうサラダ'], kcal: 150, p: 2, f: 10, c: 13, serving: '1パック' },

  // ── スイーツ・補食 ──
  { name: 'エクレア', keywords: ['エクレア'], kcal: 230, p: 4, f: 13, c: 24, serving: '1個' },
  { name: 'ロールケーキ', keywords: ['ロールケーキ'], kcal: 280, p: 4, f: 18, c: 25, serving: '1個' },
  { name: 'バウムクーヘン', keywords: ['バウムクーヘン', 'バームクーヘン'], kcal: 350, p: 5, f: 20, c: 38, serving: '1個' },
  { name: '飲むヨーグルト', keywords: ['飲むヨーグルト', 'のむヨーグルト'], kcal: 130, p: 5, f: 1, c: 25, serving: '1本' },
  { name: 'プロテインバー', keywords: ['プロテインバー'], kcal: 200, p: 15, f: 10, c: 20, serving: '1本' },
  { name: 'カロリーメイト', keywords: ['カロリーメイト'], kcal: 200, p: 4, f: 11, c: 20, serving: '2本' },
  { name: 'ソイジョイ', keywords: ['ソイジョイ'], kcal: 140, p: 4, f: 8, c: 14, serving: '1本' },
  { name: 'アイスコーヒー', keywords: ['アイスコーヒー'], kcal: 15, p: 0.5, f: 0, c: 2, serving: '1杯' },

  // ══ 大学生協・学食 ══════════════════════════════════════════════════════════════
  // ※ 全国の生協食堂で一般的なメニューの概算。小鉢は標準的な1鉢を想定。

  // ── 定食・丼・カレー ──
  { name: '日替わり定食', keywords: ['日替わり定食', '日替定食'], kcal: 700, p: 25, f: 22, c: 95, serving: '1食' },
  { name: '週替わり定食', keywords: ['週替わり定食', '週替定食'], kcal: 720, p: 25, f: 24, c: 95, serving: '1食' },
  { name: 'チキンカツ定食', keywords: ['チキンカツ定食'], kcal: 850, p: 35, f: 35, c: 95, serving: '1食' },
  { name: 'ハンバーグ定食', keywords: ['ハンバーグ定食'], kcal: 800, p: 30, f: 35, c: 90, serving: '1食' },
  { name: '日替わり丼', keywords: ['日替わり丼', '日替丼'], kcal: 650, p: 22, f: 18, c: 92, serving: '1杯' },
  { name: 'ミニ丼', keywords: ['ミニ丼'], kcal: 400, p: 12, f: 10, c: 65, serving: '1杯' },
  { name: 'ミニ親子丼', keywords: ['ミニ親子丼'], kcal: 420, p: 18, f: 10, c: 62, serving: '1杯' },
  { name: 'ミニ牛丼', keywords: ['ミニ牛丼'], kcal: 450, p: 14, f: 15, c: 65, serving: '1杯' },
  { name: '麻婆豆腐丼', keywords: ['麻婆豆腐丼', '麻婆丼'], kcal: 650, p: 20, f: 22, c: 88, serving: '1杯' },
  { name: 'ミニカレー', keywords: ['ミニカレー'], kcal: 400, p: 9, f: 12, c: 62, serving: '1皿' },
  { name: 'ボリュームカレー', keywords: ['ボリュームカレー', '大盛りカレー', 'メガカレー'], kcal: 900, p: 18, f: 28, c: 140, serving: '1皿' },
  { name: 'カツカレー', keywords: ['カツカレー'], kcal: 950, p: 30, f: 38, c: 120, serving: '1皿' },

  // ── 麺（学食） ──
  { name: 'ぶっかけうどん', keywords: ['ぶっかけうどん'], kcal: 380, p: 11, f: 3, c: 72, serving: '1杯' },
  { name: '温玉うどん', keywords: ['温玉うどん', '月見うどん'], kcal: 420, p: 14, f: 6, c: 72, serving: '1杯' },
  { name: 'ミニうどん', keywords: ['ミニうどん'], kcal: 250, p: 7, f: 2, c: 50, serving: '1杯' },
  { name: '冷やしうどん', keywords: ['冷やしうどん'], kcal: 360, p: 10, f: 3, c: 70, serving: '1杯' },
  { name: 'サラダうどん', keywords: ['サラダうどん'], kcal: 350, p: 12, f: 6, c: 60, serving: '1杯' },
  { name: 'ミニラーメン', keywords: ['ミニラーメン'], kcal: 300, p: 10, f: 10, c: 42, serving: '1杯' },

  // ── たんぱく質おかず（学食の小皿） ──
  { name: '鶏の竜田揚げ', keywords: ['竜田揚げ', '鶏の竜田揚げ', 'チキン竜田'], kcal: 380, p: 25, f: 22, c: 22, serving: '1人前' },
  { name: '白身魚フライ', keywords: ['白身魚フライ', '白身フライ', '魚フライ', 'フィッシュフライ'], kcal: 280, p: 15, f: 16, c: 18, serving: '2個' },
  { name: 'アジフライ', keywords: ['アジフライ', 'あじフライ', '鯵フライ'], kcal: 300, p: 18, f: 18, c: 18, serving: '2枚' },
  { name: 'ハムカツ', keywords: ['ハムカツ'], kcal: 250, p: 7, f: 16, c: 20, serving: '2枚' },
  { name: 'イカフライ', keywords: ['イカフライ', 'いかフライ', 'イカリング'], kcal: 270, p: 12, f: 14, c: 22, serving: '1人前' },
  { name: 'チキンステーキ', keywords: ['チキンステーキ', '鶏ステーキ'], kcal: 420, p: 32, f: 28, c: 6, serving: '1人前' },

  // ── 小鉢・副菜 ──
  { name: 'かぼちゃの煮物', keywords: ['かぼちゃの煮物', 'かぼちゃ煮', '南瓜の煮物'], kcal: 110, p: 2, f: 3, c: 20, serving: '小鉢' },
  { name: '大学いも', keywords: ['大学いも', '大学芋'], kcal: 240, p: 2, f: 8, c: 40, serving: '小鉢' },
  { name: '筑前煮', keywords: ['筑前煮', 'がめ煮'], kcal: 160, p: 8, f: 6, c: 18, serving: '小鉢' },
  { name: '里芋の煮物', keywords: ['里芋の煮物', '里芋', '煮っころがし'], kcal: 110, p: 2, f: 2, c: 20, serving: '小鉢' },
  { name: '野菜の煮物', keywords: ['野菜の煮物', '煮物', '炊き合わせ'], kcal: 120, p: 4, f: 3, c: 18, serving: '小鉢' },
  { name: 'もやしナムル', keywords: ['もやしナムル', 'ナムル'], kcal: 70, p: 2, f: 5, c: 5, serving: '小鉢' },
  { name: 'ごま和え', keywords: ['ごま和え', '胡麻和え', 'ほうれん草の胡麻和え'], kcal: 70, p: 3, f: 4, c: 6, serving: '小鉢' },
  { name: '卯の花', keywords: ['卯の花', 'おからの煮物', 'おから'], kcal: 120, p: 4, f: 6, c: 12, serving: '小鉢' },
  { name: '切り昆布の煮物', keywords: ['切り昆布', '昆布の煮物'], kcal: 70, p: 2, f: 1, c: 12, serving: '小鉢' },
  { name: '五目豆', keywords: ['五目豆', '大豆の煮物'], kcal: 100, p: 6, f: 3, c: 12, serving: '小鉢' },
  { name: '高野豆腐', keywords: ['高野豆腐', 'こうや豆腐'], kcal: 90, p: 7, f: 5, c: 4, serving: '小鉢' },
  { name: '冷やしトマト', keywords: ['冷やしトマト', 'トマトスライス'], kcal: 30, p: 1, f: 0.1, c: 6, serving: '小鉢' },
  { name: '温野菜', keywords: ['温野菜', '蒸し野菜'], kcal: 60, p: 3, f: 1, c: 10, serving: '小鉢' },
  { name: 'ブロッコリー', keywords: ['ブロッコリー'], kcal: 40, p: 3, f: 0.4, c: 5, serving: '小鉢' },
  { name: 'きのこソテー', keywords: ['きのこソテー', 'きのこのソテー'], kcal: 80, p: 3, f: 5, c: 7, serving: '小鉢' },

  // ── ライスサイズ・汁物 ──
  { name: 'ライス大盛り', keywords: ['ライス大盛り', '大盛りごはん', '大盛ごはん', 'ごはん大盛り'], kcal: 400, p: 6, f: 0.8, c: 88, serving: '大盛り(240g)' },
  { name: 'ライス中', keywords: ['ライス中', '並ごはん'], kcal: 250, p: 3.8, f: 0.5, c: 55, serving: '中(150g)' },
  { name: 'ライス小', keywords: ['ライス小', '小ライス', 'ごはん小', 'ごはん少なめ'], kcal: 170, p: 2.5, f: 0.3, c: 37, serving: '小(100g)' },
  { name: '玉子スープ', keywords: ['玉子スープ', 'たまごスープ', 'かきたま汁'], kcal: 50, p: 3, f: 2, c: 4, serving: '1杯' },
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
  let bestScore = 0;

  for (const entry of TABLE) {
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      if (k.length < 2) continue;

      // 優先順: ①完全一致 ②クエリに含まれるキーワード(長いほど具体的) ③クエリを含むキーワード(短いほど近い)
      let score: number;
      if (q === k) {
        score = 3_000_000 + k.length;       // 例:「カレー」→ カレーライス、「ラーメン」→ ラーメン
      } else if (q.includes(k)) {
        score = 2_000_000 + k.length;       // 例:「とんかつ定食」→ とんかつ定食（最長の含有語）
      } else if (k.includes(q)) {
        score = 1_000_000 - k.length;       // 断片入力のフォールバック（最も短い＝近いものを優先）
      } else {
        continue;
      }

      if (score > bestScore) {
        best = entry;
        bestScore = score;
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
  opts?: { matchCandidates?: boolean },
): MealAnalysisResult {
  // テキスト推定では候補(candidates)での照合を無効化する。
  // 例:「タコライス」の候補「ドライカレー」が『カレー』キーワードで
  // カレーライスに誤マッチするのを防ぎ、入力した料理名のみで判定する。
  const matchCandidates = opts?.matchCandidates ?? true;
  const source = matchCandidates ? [result.dishName, ...(result.candidates ?? [])] : [result.dishName];
  const names = source.filter(
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
