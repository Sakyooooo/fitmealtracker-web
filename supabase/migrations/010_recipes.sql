-- ============================================================
-- FitMealTracker: レシピのストック
--   手入力・YouTube動画解析・テキスト貼り付けで登録したレシピを
--   端末間で共有できるよう Supabase に保存し、所有者スコープのRLSで保護する。
--   栄養値（calories/PFC）は1人前あたりに正規化して保存する。
--
--   前提: 004 と同様、identity = auth.uid()。recipes.user_id は auth.uid() と一致する。
--   適用: Supabase Dashboard > SQL Editor で本ファイルを実行する。
-- ============================================================

CREATE TABLE IF NOT EXISTS recipes (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL,
  name        text NOT NULL,
  servings    numeric NOT NULL DEFAULT 1,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name, amount}]
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ["手順1", ...]
  calories    numeric,                             -- 1人前あたり kcal
  protein     numeric,
  fat         numeric,
  carbs       numeric,
  source_type text NOT NULL DEFAULT 'manual',      -- 'manual' | 'youtube' | 'text'
  source_url  text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipes_user_updated_idx
  ON recipes (user_id, updated_at DESC);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recipes_select ON recipes;
DROP POLICY IF EXISTS recipes_insert ON recipes;
DROP POLICY IF EXISTS recipes_update ON recipes;
DROP POLICY IF EXISTS recipes_delete ON recipes;

-- 所有者のみ全操作可（他人のレシピは見えない／触れない）
CREATE POLICY recipes_select ON recipes
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY recipes_insert ON recipes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY recipes_update ON recipes
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY recipes_delete ON recipes
  FOR DELETE USING (user_id = auth.uid());
