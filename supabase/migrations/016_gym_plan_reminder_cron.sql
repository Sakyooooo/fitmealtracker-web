-- ============================================================
-- FitMealTracker: ジム宣言リマインダーの定期実行（pg_cron + pg_net）
-- Supabase ダッシュボード > SQL Editor で実行
--
-- 事前準備:
--   1) 014 と同様に pg_cron / pg_net が有効であること
--   2) send-reminders Edge Function が gymPlan 対応版であること
--   3) <YOUR-PROJECT-REF> と <CRON_SECRET> を実際の値に置き換えること
--
-- JST 19:00（= UTC 10:00）に「今日を宣言しているのにまだジム記録が無い」
-- ユーザーへリマインドを送る。
-- ============================================================

SELECT cron.schedule(
  'gym-plan-reminder',
  '0 10 * * *', -- JST 19:00
  $$
  SELECT net.http_post(
    url := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := jsonb_build_object('type', 'gymPlan')
  );
  $$
);

-- 確認:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'gym-plan-reminder';
-- 削除する場合:
-- SELECT cron.unschedule('gym-plan-reminder');
