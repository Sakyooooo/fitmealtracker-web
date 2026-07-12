-- ============================================================
-- FitMealTracker: gym_sessions.workout_sets 列の修復
-- Supabase ダッシュボード > SQL Editor で実行
--
-- 007_weights_gym_sessions.sql は CREATE TABLE IF NOT EXISTS のため、
-- gym_sessions テーブルが007適用前に既に存在していた環境では
-- workout_sets 列が追加されないまま残ってしまう。
-- このSQLは列が既にあっても安全に実行できる（冪等）。
-- ============================================================

ALTER TABLE gym_sessions ADD COLUMN IF NOT EXISTS workout_sets JSONB;
