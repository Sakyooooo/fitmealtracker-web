-- ============================================================
-- FitMealTracker: 週間ジム宣言（gym_plans）
-- Supabase ダッシュボード > SQL Editor で実行
-- ※ 004（匿名認証ベースのRLS）適用後に実行すること
--
-- 「今週は月・水・金に行く」という宣言を週単位で1行持つ。
-- 実績（行ったかどうか）は exercises(type='gymSession') から導出するため
-- このテーブルには持たない。フレンドに宣言が見えることが緩い強制力になる。
-- planned_days: 0=月 … 6=日（JST基準・週の起点は月曜）
-- ============================================================

CREATE TABLE IF NOT EXISTS gym_plans (
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start   DATE        NOT NULL,
  planned_days SMALLINT[]  NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS gym_plans_week_idx ON gym_plans (week_start);

ALTER TABLE gym_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gym_plans_select ON gym_plans;
DROP POLICY IF EXISTS gym_plans_insert ON gym_plans;
DROP POLICY IF EXISTS gym_plans_update ON gym_plans;
DROP POLICY IF EXISTS gym_plans_delete ON gym_plans;

-- 読取: 本人 ＋ 承認済みフレンド（mealsと同じ流儀）
CREATE POLICY gym_plans_select ON gym_plans
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.receiver_id = gym_plans.user_id)
          OR (f.receiver_id = auth.uid() AND f.requester_id = gym_plans.user_id))
    )
  );

-- 書込: 本人のみ
CREATE POLICY gym_plans_insert ON gym_plans FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY gym_plans_update ON gym_plans FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY gym_plans_delete ON gym_plans FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE gym_plans IS '週間ジム宣言。実績はexercises(type=gymSession)から導出。planned_days: 0=月..6=日';
