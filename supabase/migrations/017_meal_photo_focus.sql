-- ============================================================
-- FitMealTracker: 食事写真の表示位置（画角）
-- Supabase ダッシュボード > SQL Editor で実行
-- ※ 002（meals）適用後に実行すること
--
-- タイムラインは写真を 4:3 に切り抜いて表示するため、縦長写真などでは
-- 料理が見切れることがある。投稿時にユーザーが決めた「どこを中心に見せるか」を
-- CSS object-position 相当の % で保持する。
--
-- NULL = 未指定 = 中央(50)。既存の投稿は NULL のままで従来と同じ見え方になる。
-- 写真そのものは切り抜かず原本を保存するため、全画面表示では全体を見られる。
-- ============================================================

ALTER TABLE meals ADD COLUMN IF NOT EXISTS photo_focus_x SMALLINT;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS photo_focus_y SMALLINT;

ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_photo_focus_x_range;
ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_photo_focus_y_range;
ALTER TABLE meals ADD CONSTRAINT meals_photo_focus_x_range CHECK (photo_focus_x IS NULL OR photo_focus_x BETWEEN 0 AND 100);
ALTER TABLE meals ADD CONSTRAINT meals_photo_focus_y_range CHECK (photo_focus_y IS NULL OR photo_focus_y BETWEEN 0 AND 100);

COMMENT ON COLUMN meals.photo_focus_x IS '写真の水平表示位置 0-100%（object-position 相当）。NULL=中央';
COMMENT ON COLUMN meals.photo_focus_y IS '写真の垂直表示位置 0-100%（object-position 相当）。NULL=中央';
