import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.beforeEach(async ({ page }) => {
  await page.goto('/data');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ─────────────────────────────────────────────────────────────────────────────
test('JSON エクスポートでファイルがダウンロードされる', async ({ page }) => {
  // 先に食事を1件追加
  await page.goto('/meal');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: 'RECORD' }).click();
  await page.getByPlaceholder(/サラダチキン/).fill('エクスポートテスト');
  await page.getByPlaceholder('例: 380').fill('400');
  await page.getByRole('button', { name: '保存する' }).click();

  await page.goto('/data');

  // エクスポートモーダルを開く
  await page.getByRole('button', { name: /エクスポート/ }).click();
  await expect(page.getByText('全期間')).toBeVisible();

  // JSON 選択
  await page.getByRole('button', { name: 'JSON' }).click();

  // ダウンロードを捕捉
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '全期間' }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/fitmealtracker.*\.json/);

  // ダウンロードしたファイルの内容を確認
  const tmpPath = path.join(os.tmpdir(), download.suggestedFilename());
  await download.saveAs(tmpPath);
  const content = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
  expect(content.meals).toBeDefined();
  expect(Array.isArray(content.meals)).toBe(true);
  expect(content.meals[0].name).toBe('エクスポートテスト');

  fs.unlinkSync(tmpPath);
});

test('JSON インポートでデータが復元される（重複スキップ）', async ({ page }) => {
  // テスト用 JSON ファイルを作成
  const testData = {
    meals: [
      {
        id: 'import-test-1',
        name: 'インポート食事',
        calories: 300,
        time: '12:00',
        category: '昼食',
        date: '2026-06-01',
      },
    ],
    exercises: [
      {
        id: 'import-ex-1',
        name: 'インポート運動',
        durationMinutes: 30,
        caloriesBurned: 150,
        date: '2026-06-01',
        note: '',
        type: 'normal',
      },
    ],
    exportedAt: '2026-06-01',
  };
  const tmpPath = path.join(os.tmpdir(), 'test-import.json');
  fs.writeFileSync(tmpPath, JSON.stringify(testData));

  await page.goto('/data');

  // confirm ダイアログを自動承認
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') await dialog.accept();
    else if (dialog.type() === 'alert') await dialog.dismiss();
  });

  await page.locator('input[type="file"][accept*="json"]').setInputFiles(tmpPath);

  // ページリロード後にデータが存在するか確認
  await page.waitForURL('/data');
  // localStorage に食事データが入っているか確認
  await page.waitForTimeout(1000);
  const meals = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('fmt_meals') ?? '[]'); } catch { return []; }
  });
  expect(meals.length).toBeGreaterThanOrEqual(1);
  expect(meals.some((m: { name: string }) => m.name === 'インポート食事')).toBe(true);

  fs.unlinkSync(tmpPath);
});
