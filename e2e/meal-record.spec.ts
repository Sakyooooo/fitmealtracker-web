import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/meal');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ─────────────────────────────────────────────────────────────────────────────
test('食事を記録するとヒーロー数値に反映される', async ({ page }) => {
  await page.getByRole('button', { name: 'RECORD' }).click();
  await expect(page.getByPlaceholder(/サラダチキン/)).toBeVisible();

  await page.getByPlaceholder(/サラダチキン/).fill('テストサラダ');
  await page.getByPlaceholder('例: 380').fill('380');
  await page.getByRole('button', { name: '保存する' }).click();

  // ヒーロー数値が 380 になる
  await expect(page.locator('p.font-black.italic').first()).toHaveText('380');
});

test('食事名が空のまま保存しようとするとモーダルが閉じない', async ({ page }) => {
  await page.getByRole('button', { name: 'RECORD' }).click();
  await expect(page.getByPlaceholder(/サラダチキン/)).toBeVisible();

  page.on('dialog', async (dialog) => await dialog.dismiss());
  await page.getByRole('button', { name: '保存する' }).click();

  // モーダルは閉じずに残る
  await expect(page.getByPlaceholder(/サラダチキン/)).toBeVisible();
});

test('複数食事を記録するとカロリーが合算される', async ({ page }) => {
  for (const [name, cal] of [['朝食テスト', '300'], ['昼食テスト', '500']]) {
    await page.getByRole('button', { name: 'RECORD' }).click();
    await page.getByPlaceholder(/サラダチキン/).fill(name);
    await page.getByPlaceholder('例: 380').fill(cal);
    await page.getByRole('button', { name: '保存する' }).click();
  }

  await expect(page.locator('p.font-black.italic').first()).toHaveText('800');
});
