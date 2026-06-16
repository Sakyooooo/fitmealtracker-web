-- ============================================================
-- FitMealTracker: タイムライン投稿へのコメント
-- Supabase ダッシュボード > SQL Editor で実行
-- ※ 004（匿名認証ベースのRLS）適用後に実行すること
--
-- reactions と同じ設計。1投稿(record_id)に複数コメント可。
-- 本人(auth.uid)のみ投稿・削除でき、読取はフレンド表示のため全員可。
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_id     UUID        NOT NULL,
  record_type   TEXT        NOT NULL CHECK (record_type IN ('meal', 'exercise')),
  body          TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_record_idx  ON comments (record_id);
CREATE INDEX IF NOT EXISTS comments_created_idx ON comments (created_at);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_select ON comments;
DROP POLICY IF EXISTS comments_insert ON comments;
DROP POLICY IF EXISTS comments_delete ON comments;

-- 表示用に読取は許可（リアクションと同様）
CREATE POLICY comments_select ON comments FOR SELECT USING (true);
-- 投稿・削除は本人のみ
CREATE POLICY comments_insert ON comments FOR INSERT WITH CHECK (from_user_id = auth.uid());
CREATE POLICY comments_delete ON comments FOR DELETE USING (from_user_id = auth.uid());

COMMENT ON TABLE comments IS 'タイムライン投稿(meal/exercise)へのコメント。1投稿に複数可';
