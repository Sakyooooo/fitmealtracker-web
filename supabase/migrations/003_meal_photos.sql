-- ============================================================
-- FitMealTracker: 食事写真（タイムライン写真強調）
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- ============================================================

-- ── meals に写真 URL 列を追加 ──────────────────────────────────────────────────
ALTER TABLE meals ADD COLUMN IF NOT EXISTS photo_url TEXT;
COMMENT ON COLUMN meals.photo_url IS 'Supabase Storage(meal-photos)の公開URL。タイムライン写真強調表示に使用';

-- ── Storage バケット作成（公開読み取り）──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-photos', 'meal-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ── Storage ポリシー（MVP: anon でも読み書き可）────────────────────────────────
-- 既存ポリシーがあれば作り直す
DROP POLICY IF EXISTS "meal_photos_read"   ON storage.objects;
DROP POLICY IF EXISTS "meal_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "meal_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "meal_photos_delete" ON storage.objects;

CREATE POLICY "meal_photos_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meal-photos');

CREATE POLICY "meal_photos_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meal-photos');

CREATE POLICY "meal_photos_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'meal-photos');

CREATE POLICY "meal_photos_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'meal-photos');
