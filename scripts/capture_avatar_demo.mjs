// ジムセッションのアバター種目計測フロー確認用キャプチャ
// 使い方: dev サーバー起動中に node scripts/capture_avatar_demo.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const OUT = resolve('docs/design/screens');
mkdirSync(OUT, { recursive: true });

const seed = {
  fmt_onboarding_done: '1',
  fmt_migration_done: '1',
  fmt_recap_shown_date: new Date().toISOString().slice(0, 10),
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ja-JP',
});
await ctx.route('**://*.supabase.co/**', (r) => r.abort());
await ctx.addInitScript((data) => {
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal{display:none!important}';
    document.head.appendChild(style);
  });
}, seed);

const page = await ctx.newPage();
await page.goto('http://localhost:3000/exercise');
await page.getByText('START').waitFor({ timeout: 30000 });
await page.waitForTimeout(800);

// セッション開始
await page.getByRole('button', { name: 'START' }).click();
await page.getByText('LIVE').waitFor();
await page.waitForTimeout(5000); // GLB ロード

// スクワットの計測を開始 → アバターが実演 + タイマーバー
await page.getByRole('button', { name: 'スクワット', exact: true }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/avatar-11-squat-timing.png` });
console.log('✔ squat timing');

// クランチに切替（スクワットが自動保存される）→ アバターが腹筋を実演
await page.getByRole('button', { name: 'クランチ' }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/avatar-12-crunch-switch.png` });
console.log('✔ crunch switch (squat auto-saved)');

// 完了 → 待機に戻る
await page.getByRole('button', { name: '完了' }).click();
await page.waitForTimeout(1500);

// セッション終了 → 完了画面（セッション中の種目チップが出るはず）
await page.getByRole('button', { name: '終了' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/avatar-13-complete-prefill.png` });
console.log('✔ complete screen');

// プリフィルチップをタップ → フォームに種目名が入る
await page.getByRole('button', { name: '＋ スクワット' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/avatar-14-set-form-prefilled.png` });
console.log('✔ set form prefilled');

// 記録された ExerciseEntry を確認
const entries = await page.evaluate(() => JSON.parse(localStorage.getItem('fmt_exercises') || '[]'));
console.log('saved exercises:', entries.map((e) => `${e.name} ${e.durationMinutes}分 ${e.caloriesBurned}kcal (${e.type})`));

await browser.close();
console.log('✅ 完了:', OUT);
