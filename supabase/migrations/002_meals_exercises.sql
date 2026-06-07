-- ============================================================
-- FitMealTracker: meals / exercises / reactions
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- ============================================================

-- ── meals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id               UUID        PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  calories         INT         NOT NULL,
  time             TEXT        NOT NULL,
  category         TEXT        NOT NULL,
  date             DATE        NOT NULL,
  note             TEXT,
  protein          FLOAT,
  fat              FLOAT,
  carbs            FLOAT,
  is_public        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meals_user_id_idx  ON meals (user_id);
CREATE INDEX IF NOT EXISTS meals_date_idx      ON meals (date DESC);
CREATE INDEX IF NOT EXISTS meals_created_idx   ON meals (created_at DESC);

-- ── exercises ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id               UUID        PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  duration_minutes INT         NOT NULL,
  calories_burned  INT         NOT NULL,
  date             DATE        NOT NULL,
  note             TEXT,
  type             TEXT        NOT NULL DEFAULT 'normal',
  is_public        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exercises_user_id_idx ON exercises (user_id);
CREATE INDEX IF NOT EXISTS exercises_date_idx     ON exercises (date DESC);
CREATE INDEX IF NOT EXISTS exercises_created_idx  ON exercises (created_at DESC);

-- ── reactions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_id     UUID        NOT NULL,
  record_type   TEXT        NOT NULL CHECK (record_type IN ('meal', 'exercise')),
  emoji         TEXT        NOT NULL CHECK (emoji IN ('💪','🔥','👍','🎉')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 1ユーザー1レコードに1リアクションのみ
  UNIQUE (from_user_id, record_id)
);

CREATE INDEX IF NOT EXISTS reactions_record_idx ON reactions (record_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE meals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions  ENABLE ROW LEVEL SECURITY;

-- meals: 全員が読める、書き込み・削除は自由（MVP: user_id 信頼）
CREATE POLICY "meals_select"  ON meals FOR SELECT  USING (true);
CREATE POLICY "meals_insert"  ON meals FOR INSERT  WITH CHECK (true);
CREATE POLICY "meals_update"  ON meals FOR UPDATE  USING (true);
CREATE POLICY "meals_delete"  ON meals FOR DELETE  USING (true);

-- exercises
CREATE POLICY "exercises_select" ON exercises FOR SELECT  USING (true);
CREATE POLICY "exercises_insert" ON exercises FOR INSERT  WITH CHECK (true);
CREATE POLICY "exercises_update" ON exercises FOR UPDATE  USING (true);
CREATE POLICY "exercises_delete" ON exercises FOR DELETE  USING (true);

-- reactions
CREATE POLICY "reactions_select" ON reactions FOR SELECT  USING (true);
CREATE POLICY "reactions_insert" ON reactions FOR INSERT  WITH CHECK (true);
CREATE POLICY "reactions_delete" ON reactions FOR DELETE  USING (true);

-- ── コメント ──────────────────────────────────────────────────────────────────
COMMENT ON COLUMN meals.is_public      IS 'true=フレンドのタイムラインに表示';
COMMENT ON COLUMN exercises.is_public  IS 'true=フレンドのタイムラインに表示';
COMMENT ON TABLE  reactions            IS '1ユーザーが1レコードに持てるリアクションは1件';
