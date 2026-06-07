-- ============================================================
-- FitMealTracker: プロフィール画像（フレンド共有）
-- Supabase ダッシュボード > SQL Editor で実行
-- ※ 004（匿名認証ベースのRLS）適用後に実行すること
-- ============================================================

-- ── users に avatar_url 列を追加（軽量な data URL を保存）────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
COMMENT ON COLUMN users.avatar_url IS 'プロフィール画像（256px JPEG の data URL）。フレンドのタイムライン/地球儀に表示';

-- ── users の更新を本人のみに許可 ──────────────────────────────────────────────
-- 001 では users に UPDATE ポリシーが無く、display_name/avatar_url の更新が
-- RLS で拒否されていた。本人(auth.uid)のみ更新可にして解消する。
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
