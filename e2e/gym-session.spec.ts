import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/exercise');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ─────────────────────────────────────────────────────────────────────────────
test('【バグ修正確認】目標未設定でも START → セッション中画面が表示される', async ({ page }) => {
  await page.getByRole('button', { name: 'START' }).click();

  await expect(page.getByText('LIVE')).toBeVisible();
  await expect(page.getByRole('button', { name: '終了' })).toBeVisible();
});

test('セッション開始 → 終了 → カロリー入力 → 保存 → 運動記録に追加される', async ({ page }) => {
  await page.getByRole('button', { name: 'START' }).click();
  await expect(page.getByText('LIVE')).toBeVisible();

  await page.getByRole('button', { name: '終了' }).click();
  await expect(page.getByText('完了')).toBeVisible();

  await page.getByPlaceholder('0').fill('250');
  await page.getByRole('button', { name: '保存' }).click();

  // Recent Activity を開く（CSS uppercase は accessible name に影響しないので case insensitive で検索）
  await page.getByRole('button', { name: /Recent Activity/i }).click();
  await expect(page.getByText('ジムセッション').first()).toBeVisible();
});

test('× ボタンでセッションをキャンセルできる', async ({ page }) => {
  await page.getByRole('button', { name: 'START' }).click();
  await expect(page.getByText('LIVE')).toBeVisible();

  await page.getByRole('button', { name: '×' }).click();

  await expect(page.getByRole('button', { name: 'START' })).toBeVisible();
});
