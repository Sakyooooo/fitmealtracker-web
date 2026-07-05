-- ============================================================
-- FitMealTracker: 食事のフレンドタグ付け & シェア（自分の記録へコピー）
-- Supabase ダッシュボード > SQL Editor で実行
-- ※ 002（meals）適用後に実行すること
--
-- ・tagged_user_ids: この食事にタグ付けされたフレンドの user_id 配列。
--   該当者のタイムラインに「自分の記録にシェア」ボタンを表示する。
-- ・shared_from_meal_id: シェア操作で作成された食事の場合、コピー元の
--   meal.id を保持。二重シェアの防止（「シェア済み」判定）に使用する。
-- ============================================================

ALTER TABLE meals ADD COLUMN IF NOT EXISTS tagged_user_ids    UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE meals ADD COLUMN IF NOT EXISTS shared_from_meal_id UUID;

-- タグ検索（tagged_user_ids @> ARRAY[uid]）を効かせる GIN インデックス
CREATE INDEX IF NOT EXISTS meals_tagged_idx      ON meals USING GIN (tagged_user_ids);
-- 二重シェア判定（user_id = me AND shared_from_meal_id IN (...)）用
CREATE INDEX IF NOT EXISTS meals_shared_from_idx ON meals (shared_from_meal_id);

COMMENT ON COLUMN meals.tagged_user_ids     IS 'タグ付けされたフレンドのuser_id配列。該当者のタイムラインにシェアボタンを表示';
COMMENT ON COLUMN meals.shared_from_meal_id IS 'シェアで作成された食事の場合、コピー元meal.id。二重シェア判定に使用';
