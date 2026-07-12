-- ============================================================
-- FitMealTracker: 食事リマインダーの定期実行（pg_cron + pg_net）
-- Supabase ダッシュボード > SQL Editor で実行
--
-- 事前準備（ダッシュボードで実施すること）:
--   1) Database > Extensions で pg_cron と pg_net を有効化
--   2) send-reminders Edge Function をデプロイ済みであること
--   3) 下記の <YOUR-PROJECT-REF> と <CRON_SECRET> を実際の値に置き換えること
--      （CRON_SECRET は Edge Function の secrets に設定した値と同じもの）
--
-- 時刻は JST 07:00 / 12:00 / 18:00 → cron式はUTC基準(-9h)で指定。
-- ============================================================

SELECT cron.schedule(
  'meal-reminder-breakfast',
  '0 22 * * *', -- JST 07:00
  $$
  SELECT net.http_post(
    url := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := jsonb_build_object('category', '朝食')
  );
  $$
);

SELECT cron.schedule(
  'meal-reminder-lunch',
  '0 3 * * *', -- JST 12:00
  $$
  SELECT net.http_post(
    url := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := jsonb_build_object('category', '昼食')
  );
  $$
);

SELECT cron.schedule(
  'meal-reminder-dinner',
  '0 9 * * *', -- JST 18:00
  $$
  SELECT net.http_post(
    url := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := jsonb_build_object('category', '夕食')
  );
  $$
);

-- 確認: 登録されたジョブ一覧
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'meal-reminder-%';

-- 削除する場合:
-- SELECT cron.unschedule('meal-reminder-breakfast');
-- SELECT cron.unschedule('meal-reminder-lunch');
-- SELECT cron.unschedule('meal-reminder-dinner');
