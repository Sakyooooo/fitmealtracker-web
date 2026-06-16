-- ============================================================
-- FitMealTracker: 体重・ジムセッションの端末間同期（バックアップ）
-- Supabase ダッシュボード > SQL Editor で実行
-- ※ 004（匿名認証ベースのRLS）適用後に実行すること
--
-- 体重・ジムセッションは「本人専用（プライベート）」データ。
-- meals/exercises と違い is_public を持たず、フレンドには一切公開しない。
-- 端末を変えても自分の記録が復元できるようにするためのテーブル。
-- ============================================================

-- ── weights ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weights (
  id          UUID        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  weight_kg   FLOAT       NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS weights_user_id_idx ON weights (user_id);
CREATE INDEX IF NOT EXISTS weights_date_idx     ON weights (date DESC);

ALTER TABLE weights ENABLE ROW LEVEL SECURITY;

-- 体重は本人のみ読み書き可（フレンドにも公開しない）
DROP POLICY IF EXISTS weights_select ON weights;
DROP POLICY IF EXISTS weights_insert ON weights;
DROP POLICY IF EXISTS weights_update ON weights;
DROP POLICY IF EXISTS weights_delete ON weights;

CREATE POLICY weights_select ON weights FOR SELECT USING (user_id = auth.uid());
CREATE POLICY weights_insert ON weights FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY weights_update ON weights FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY weights_delete ON weights FOR DELETE USING (user_id = auth.uid());

-- ── gym_sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gym_sessions (
  id                        UUID        PRIMARY KEY,
  user_id                   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at                TIMESTAMPTZ NOT NULL,
  ended_at                  TIMESTAMPTZ,
  duration_sec              INT,
  estimated_calories_burned INT,
  memo                      TEXT,
  workout_sets              JSONB,
  status                    TEXT        NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active', 'completed', 'canceled')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gym_sessions_user_id_idx ON gym_sessions (user_id);
CREATE INDEX IF NOT EXISTS gym_sessions_status_idx   ON gym_sessions (status);

ALTER TABLE gym_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gym_sessions_select ON gym_sessions;
DROP POLICY IF EXISTS gym_sessions_insert ON gym_sessions;
DROP POLICY IF EXISTS gym_sessions_update ON gym_sessions;
DROP POLICY IF EXISTS gym_sessions_delete ON gym_sessions;

CREATE POLICY gym_sessions_select ON gym_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY gym_sessions_insert ON gym_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY gym_sessions_update ON gym_sessions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY gym_sessions_delete ON gym_sessions FOR DELETE USING (user_id = auth.uid());

-- ── コメント ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE weights      IS '体重記録（本人専用・端末間同期用）。フレンドには公開しない';
COMMENT ON TABLE gym_sessions IS 'ジムセッション（本人専用・端末間同期用）。完了後は exercises に変換される';
