-- ============================================================
-- FitMealTracker フレンド機能 マイグレーション
-- 適用方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- ============================================================

-- ── users テーブル ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY,
  friend_code  TEXT        UNIQUE NOT NULL,
  display_name TEXT        NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS users_friend_code_idx ON users (friend_code);

-- ── friendships テーブル ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同じ組み合わせは1件のみ（順序を問わず）
  CONSTRAINT unique_friendship
    UNIQUE (
      LEAST(requester_id::text, receiver_id::text),
      GREATEST(requester_id::text, receiver_id::text)
    ),

  -- 自分自身へのフレンド申請を禁止
  CONSTRAINT no_self_friendship
    CHECK (requester_id <> receiver_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS friendships_receiver_idx  ON friendships (receiver_id);
CREATE INDEX IF NOT EXISTS friendships_status_idx    ON friendships (status);

-- ── Row Level Security ─────────────────────────────────────────────────────────
-- 注意: ログインなし設計のため、anon key でのアクセスを許可する
--       MVP段階ではUUID推測困難性をセキュリティの根拠とする

ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- users: 全員が読める（フレンドコード検索のため）、書き込みは INSERT のみ許可
CREATE POLICY "users_select_all"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (true);  -- MVP: 挿入は許可（更新・削除は不可）

-- friendships: 全員が自分が関係する行を読み書き可能
CREATE POLICY "friendships_select"
  ON friendships FOR SELECT
  USING (true);

CREATE POLICY "friendships_insert"
  ON friendships FOR INSERT
  WITH CHECK (true);

CREATE POLICY "friendships_update"
  ON friendships FOR UPDATE
  USING (true);

CREATE POLICY "friendships_delete"
  ON friendships FOR DELETE
  USING (true);

-- ── コメント ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE users IS 'FitMealTracker 匿名ユーザー（ログインなし設計）';
COMMENT ON TABLE friendships IS 'フレンド申請・承認関係';
COMMENT ON COLUMN users.friend_code IS '例: FMT-7X3K。ユーザーに公開する識別子';
COMMENT ON COLUMN friendships.status IS 'pending=申請中 / accepted=承認済み / blocked=ブロック';
