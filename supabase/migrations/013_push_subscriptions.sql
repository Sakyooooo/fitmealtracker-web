-- ============================================================
-- FitMealTracker: Web Push 購読情報
-- Supabase ダッシュボード > SQL Editor で実行
-- ※ 004（匿名認証ベースのRLS）適用後に実行すること
--
-- 食事リマインダーをアプリを閉じていても届けるための購読情報。
-- 1ユーザーが複数端末で購読できるよう endpoint 単位で管理する。
-- 「通知ON」= この端末の購読行が存在する、として別途の設定テーブルは持たない。
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete ON push_subscriptions;

-- 本人のみ読み書き可（フレンドにも公開しない）
CREATE POLICY push_subscriptions_select ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY push_subscriptions_insert ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY push_subscriptions_update ON push_subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY push_subscriptions_delete ON push_subscriptions FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE push_subscriptions IS 'Web Push購読情報。本人専用・端末ごとに1行。send-reminders Edge Functionから参照';
