import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/data');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ─────────────────────────────────────────────────────────────────────────────
test('デフォルトは「統計」タブが選択されている', async ({ page }) => {
  await page.goto('/data');
  // 統計タブが active（bg-white）状態か確認
  const statsBtn = page.getByRole('button', { name: '統計' });
  await expect(statsBtn).toHaveClass(/bg-white/);
});

test('「体重」タブをクリック → リロード後も体重タブが選択されている', async ({ page }) => {
  await page.goto('/data');
  await page.getByRole('button', { name: '体重' }).click();

  // localStorage に保存されていることを確認
  const stored = await page.evaluate(() => localStorage.getItem('fmt_data_tab'));
  expect(stored).toBe('weight');

  // リロード後も体重タブが選択されている
  await page.reload();
  const weightBtn = page.getByRole('button', { name: '体重' });
  await expect(weightBtn).toHaveClass(/bg-white/);
});

test('「カレンダー」タブをクリック → リロード後もカレンダータブが維持される', async ({ page }) => {
  await page.goto('/data');
  await page.getByRole('button', { name: 'カレンダー' }).click();

  await page.reload();
  const calendarBtn = page.getByRole('button', { name: 'カレンダー' });
  await expect(calendarBtn).toHaveClass(/bg-white/);
});

test('?tab=weight クエリパラメータで体重タブが開く', async ({ page }) => {
  await page.goto('/data?tab=weight');
  const weightBtn = page.getByRole('button', { name: '体重' });
  await expect(weightBtn).toHaveClass(/bg-white/);
});
