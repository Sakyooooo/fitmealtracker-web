// 全画面スクリーンショット撮影（デザインハンドオフ用）
// 使い方: NEXT_PUBLIC_DEMO_FRIENDS=on で dev サーバーを起動した状態で
//   node scripts/capture_screens.mjs
// 出力: docs/design/screens/*.png ＋ all-screens.png（コンタクトシート）

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = 'http://localhost:3000';
const OUT = resolve('docs/design/screens');
mkdirSync(OUT, { recursive: true });

// ── デモデータ ────────────────────────────────────────────────────────────────
const day = (n) => {
  const t = new Date();
  t.setDate(t.getDate() - n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const meals = [
  { id: 'm1', name: '納豆ご飯と味噌汁', calories: 420, time: '07:20', category: '朝食', date: day(0), protein: 18, fat: 9, carbs: 65 },
  { id: 'm2', name: '鶏むね肉のサラダボウル', calories: 520, time: '12:30', category: '昼食', date: day(0), protein: 42, fat: 12, carbs: 45 },
  { id: 'm3', name: '肉じゃが、豆腐とわかめの味噌汁', calories: 630, time: '19:10', category: '夕食', date: day(0), protein: 32, fat: 14, carbs: 68 },
  { id: 'm4', name: 'オートミールとゆで卵', calories: 380, time: '07:30', category: '朝食', date: day(1), protein: 22, fat: 11, carbs: 48 },
  { id: 'm5', name: '牛丼（並）', calories: 730, time: '12:40', category: '昼食', date: day(1), protein: 23, fat: 25, carbs: 100 },
  { id: 'm6', name: '焼き鮭定食', calories: 640, time: '19:30', category: '夕食', date: day(1), protein: 38, fat: 18, carbs: 78 },
  { id: 'm7', name: '一日の食事', calories: 1780, time: '12:00', category: '昼食', date: day(2) },
  { id: 'm8', name: '一日の食事', calories: 1920, time: '12:00', category: '昼食', date: day(3) },
  { id: 'm9', name: '一日の食事', calories: 1650, time: '12:00', category: '昼食', date: day(4) },
  { id: 'm10', name: '一日の食事', calories: 2050, time: '12:00', category: '昼食', date: day(5) },
  { id: 'm11', name: '一日の食事', calories: 1840, time: '12:00', category: '昼食', date: day(6) },
];

const exercises = [
  { id: 'e1', name: 'ランニング', durationMinutes: 30, caloriesBurned: 280, date: day(0), note: '', type: 'normal' },
  { id: 'e2', name: '筋トレ（上半身）', durationMinutes: 45, caloriesBurned: 210, date: day(2), note: 'ベンチプレス 60kg', type: 'normal' },
  { id: 'e3', name: 'ウォーキング', durationMinutes: 40, caloriesBurned: 150, date: day(4), note: '', type: 'normal' },
];

const weights = [6, 5, 4, 3, 2, 1, 0].map((n, i) => ({
  id: `w${i}`, date: day(n), weightKg: Math.round((72.5 - i * 0.15) * 10) / 10,
}));

const settings = {
  targetIntakeCalories: 2000, targetBurnedCalories: 300,
  targetProtein: 120, targetFat: 60, targetCarbs: 250,
  heightCm: 172, targetWeightKg: 68, sex: 'male', birthYear: 1995, activityLevel: 'light',
};

const now = new Date().toISOString();
const recipes = [
  {
    id: 'r1', name: '肉じゃが', servings: 2,
    ingredients: [
      { name: '豚こま肉', amount: '200g' }, { name: 'じゃがいも', amount: '3個' },
      { name: '玉ねぎ', amount: '1個' }, { name: 'にんじん', amount: '1/2本' },
      { name: 'しょうゆ', amount: '大さじ3' }, { name: 'みりん', amount: '大さじ2' },
    ],
    steps: ['野菜を一口大に切る', '鍋で豚肉を炒め、野菜を加える', '水400mlと調味料を入れて15分煮込む'],
    calories: 380, protein: 18.5, fat: 12, carbs: 45,
    sourceType: 'text', sourceUrl: null, note: null, createdAt: now, updatedAt: now,
  },
  {
    id: 'r2', name: '鶏むねの照り焼き', servings: 1,
    ingredients: [
      { name: '鶏むね肉', amount: '1枚' }, { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' }, { name: '砂糖', amount: '小さじ1' },
    ],
    steps: ['鶏むね肉をそぎ切りにする', 'フライパンで両面を焼く', '調味料を絡めて照りを出す'],
    calories: 320, protein: 45, fat: 8, carbs: 12,
    sourceType: 'manual', sourceUrl: null, note: '高タンパクの定番', createdAt: now, updatedAt: now,
  },
];

const seed = {
  fmt_onboarding_done: '1',
  fmt_migration_done: '1',
  fmt_recap_shown_date: day(1), // 起動時の自動リキャップを抑止
  fmt_display_name: 'Sakyo',
  fmt_friend_code: 'FMT-7X3K',
  fmt_meal_notifications_enabled: 'false',
  fmt_meals: JSON.stringify(meals),
  fmt_exercises: JSON.stringify(exercises),
  fmt_weight_records: JSON.stringify(weights),
  fmt_settings: JSON.stringify(settings),
  fmt_recipes: JSON.stringify(recipes),
  fmt_gym_sessions: '[]',
  fmt_my_foods: '[]',
};

// ── 撮影 ──────────────────────────────────────────────────────────────────────
const shots = []; // {file, label}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'ja-JP',
  });
  // Supabase への書き込み（匿名ユーザー作成等）を遮断してローカルのみで動かす
  await ctx.route('**://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((data) => {
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    // Next.js devtools バッジ（左下の "1 Issue"）を撮影から除外
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none!important}';
      document.head.appendChild(style);
    });
  }, seed);

  const page = await ctx.newPage();

  async function shot(file, label) {
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${file}.png` });
    shots.push({ file, label });
    console.log('✔', file);
  }

  async function shotScrolled(file, label, dy = 700) {
    const canScroll = await page.evaluate(
      (d) => document.body.scrollHeight > window.innerHeight + 150 ? (window.scrollBy(0, d), true) : false, dy,
    );
    if (canScroll) { await shot(file, label); await page.evaluate(() => window.scrollTo(0, 0)); }
  }

  // 1. 食事
  await page.goto(`${BASE}/meal`);
  await page.getByText('KCAL TODAY').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot('01-meal', '食事（ホーム）');

  // 2-3. 食事追加モーダル（クイック / 詳細）
  await page.getByRole('button', { name: 'RECORD' }).click();
  await page.getByText('食事を追加').waitFor();
  await shot('02-meal-add-quick', '食事追加（クイック）');
  await page.getByRole('button', { name: '✏️ 詳細' }).click();
  await shot('03-meal-add-detail', '食事追加（詳細・上部)');
  // モーダル内をスクロールして下半分（日時・区分・PFC・メモ）も撮る
  await page.evaluate(() => {
    const scroller = document.querySelector('.fixed.inset-0 .overflow-y-auto');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await shot('03b-meal-add-detail2', '食事追加（詳細・下部)');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '×' }).first().click().catch(() => {});
  await page.waitForTimeout(300);

  // 4. 運動
  await page.goto(`${BASE}/exercise`);
  await page.waitForTimeout(1800);
  await shot('04-exercise', '運動');
  await shotScrolled('05-exercise-scroll', '運動（スクロール）');

  // 5. 友達（デモタイムライン＋地球儀）
  await page.goto(`${BASE}/friends`);
  // デモ投稿（ランニング）が描画されるまで待つ
  await page.getByText('ランニング').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await shot('06-friends-timeline', '友達（タイムライン）');
  // World（地球儀）ビューに切り替え、three.js のロード完了を待つ
  const worldBtn = page.getByText('World', { exact: false }).first();
  if (await worldBtn.count() > 0) {
    await worldBtn.click().catch(() => {});
    await page.waitForTimeout(2500);
    await page.getByText('LOADING').first().waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await shot('07-friends-globe', '友達（地球儀）');
  }

  // 6. マイページ: カレンダー
  await page.goto(`${BASE}/profile`);
  await page.getByText('カレンダー').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('08-profile-calendar', 'マイページ（カレンダー）');

  // 7. 今日のふり返り（スワイプカード）
  const recapBtn = page.getByText('今日のふり返りを見る');
  if (await recapBtn.count() > 0) {
    await recapBtn.first().click();
    await page.waitForTimeout(1200);
    await shot('09-daily-recap', '今日のふり返り');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // 8-10. マイページ: 概要 / 統計 / 体重
  await page.goto(`${BASE}/profile?tab=overview`);
  await page.waitForTimeout(1500);
  await shot('10-profile-overview', 'マイページ（概要）');
  await shotScrolled('11-profile-overview-scroll', 'マイページ（概要・下部）');

  await page.goto(`${BASE}/profile?tab=stats`);
  await page.waitForTimeout(1800);
  await shot('12-profile-stats', 'マイページ（統計）');
  await shotScrolled('13-profile-stats-scroll', 'マイページ（統計・下部）');

  await page.goto(`${BASE}/profile?tab=weight`);
  await page.waitForTimeout(1800);
  await shot('14-profile-weight', 'マイページ（体重）');

  // 11-12. マイページ: レシピ一覧 → 詳細
  await page.goto(`${BASE}/profile`);
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'レシピ' }).click();
  await page.waitForTimeout(600);
  await shot('15-profile-recipes', 'マイページ（レシピ）');
  await page.getByText('肉じゃが').first().click();
  await page.waitForTimeout(600);
  await shot('16-recipe-detail', 'レシピ詳細');

  await browser.close();

  // ── コンタクトシート生成 ────────────────────────────────────────────────────
  const cells = shots.map((s) =>
    `<div class="cell"><img src="${OUT.replace(/\\/g, '/')}/${s.file}.png"><p>${s.file.replace(/^\d+-/, '')}｜${s.label}</p></div>`,
  ).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:24px;background:#1a1a1e;font-family:'Segoe UI',sans-serif}
    h1{color:#fff;font-size:20px;margin:0 0 4px}
    .sub{color:#9a9aa2;font-size:12px;margin-bottom:20px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
    .cell img{width:100%;border-radius:14px;display:block;box-shadow:0 4px 24px rgba(0,0,0,.5)}
    .cell p{color:#c9c9d0;font-size:12px;margin:8px 0 0;text-align:center}
  </style>
  <h1>FitMealTracker — 全画面スクリーンショット</h1>
  <div class="sub">${new Date().toLocaleDateString('ja-JP')} ・ 390×844 (2x) ・ デモデータ表示</div>
  <div class="grid">${cells}</div>`;
  const sheetPath = `${OUT}/_sheet.html`;
  writeFileSync(sheetPath, html);

  const b2 = await chromium.launch();
  const p2 = await b2.newPage({ viewport: { width: 1560, height: 900 } });
  await p2.goto('file:///' + sheetPath.replace(/\\/g, '/'));
  await p2.waitForTimeout(1500);
  await p2.screenshot({ path: `${OUT}/all-screens.png`, fullPage: true });
  await b2.close();
  console.log('\n✅ 完了:', OUT);
  console.log('   コンタクトシート: all-screens.png（' + shots.length + '画面）');
}

main().catch((e) => { console.error(e); process.exit(1); });
