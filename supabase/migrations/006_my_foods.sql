-- ============================================================
-- FitMealTracker: マイ食品（ユーザー自前登録の食品）
--   市販品でOFF未登録のものや、よく食べる自作メニューを登録・再利用するためのテーブル。
--   端末間で共有できるよう Supabase に保存し、所有者スコープのRLSで保護する。
--
--   前提: 004 と同様、identity = auth.uid()。my_foods.user_id は auth.uid() と一致する。
--   適用: Supabase Dashboard > SQL Editor で本ファイルを実行する。
-- ============================================================

CREATE TABLE IF NOT EXISTS my_foods (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL,
  name          text NOT NULL,
  barcode       text,
  basis         text NOT NULL DEFAULT 'serving',   -- 'serving' | '100g'
  serving_label text,
  calories      numeric NOT NULL,
  protein       numeric,
  fat           numeric,
  carbs         numeric,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 同一ユーザー内で barcode から素早く引くための部分インデックス
CREATE INDEX IF NOT EXISTS my_foods_user_barcode_idx
  ON my_foods (user_id, barcode)
  WHERE barcode IS NOT NULL;

ALTER TABLE my_foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS my_foods_select ON my_foods;
DROP POLICY IF EXISTS my_foods_insert ON my_foods;
DROP POLICY IF EXISTS my_foods_update ON my_foods;
DROP POLICY IF EXISTS my_foods_delete ON my_foods;

-- 所有者のみ全操作可（他人のマイ食品は見えない／触れない）
CREATE POLICY my_foods_select ON my_foods
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY my_foods_insert ON my_foods
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY my_foods_update ON my_foods
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY my_foods_delete ON my_foods
  FOR DELETE USING (user_id = auth.uid());
