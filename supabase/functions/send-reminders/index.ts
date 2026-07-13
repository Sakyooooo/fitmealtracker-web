// FitMealTracker: リマインダーの Web Push 送信（食事＋ジム宣言）
//
// pg_cron から起動される。アプリを開いていなくても届く。
//   - 食事: JST 07:00/12:00/18:00（migration 014）。category を指定。
//   - ジム宣言: JST 19:00（migration 016）。type: "gymPlan" を指定し、
//     今日を宣言しているのにまだジム記録が無いユーザーへ送る。
//
// 呼び出し例:
//   POST /functions/v1/send-reminders
//   headers: { "x-cron-secret": "<CRON_SECRET>" }
//   body:    { "category": "朝食" }
//   body:    { "type": "gymPlan" }
//   body:    { ..., "dryRun": true }  // 送信せず対象者一覧のみ返す
//
// 必須 secrets（`supabase secrets set` で設定）:
//   CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動注入する。

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

type MealCategory = '朝食' | '昼食' | '夕食' | '間食';
const REMINDER_LABEL: Record<MealCategory, string> = {
  朝食: '朝食の時間です',
  昼食: '昼食の時間です',
  夕食: '夕食の時間です',
  間食: '間食の時間です',
};

function todayJst(): string {
  // JSTの「今日」をYYYY-MM-DDで得る（サーバーはUTC想定のため+9h補正）
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function weekStartJst(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  return now.toISOString().slice(0, 10);
}

function todayIndexJst(): number {
  // 0=月 … 6=日（gym_plans.planned_days と同じ規約）
  return (new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay() + 6) % 7;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { category?: MealCategory; type?: 'gymPlan'; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  const isGymPlan = body.type === 'gymPlan';
  const category = body.category;
  if (!isGymPlan && (!category || !(category in REMINDER_LABEL))) {
    return new Response('category is required (朝食|昼食|夕食|間食)', { status: 400 });
  }
  const dryRun = body.dryRun === true;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = todayJst();

  // 通知対象外にするユーザーを特定する:
  //  - 食事: 今日そのカテゴリを既に記録済みの人
  //  - ジム宣言: 今日を宣言していない人 ＋ 既に今日ジムへ行った人
  let excluded: Set<string>;
  let plannedToday: Set<string> | null = null; // gymPlan時のみ「今日を宣言した人」
  if (isGymPlan) {
    const todayIdx = todayIndexJst();
    const [plansRes, doneRes] = await Promise.all([
      supabase.from('gym_plans').select('user_id')
        .eq('week_start', weekStartJst())
        .contains('planned_days', [todayIdx]),
      supabase.from('exercises').select('user_id')
        .eq('date', today)
        .eq('type', 'gymSession'),
    ]);
    if (plansRes.error) {
      return new Response(JSON.stringify({ error: plansRes.error.message }), { status: 500 });
    }
    plannedToday = new Set((plansRes.data ?? []).map((r) => r.user_id as string));
    excluded = new Set((doneRes.data ?? []).map((r) => r.user_id as string));
  } else {
    const { data: mealRows, error: mealsError } = await supabase
      .from('meals')
      .select('user_id')
      .eq('date', today)
      .eq('category', category);
    if (mealsError) {
      return new Response(JSON.stringify({ error: mealsError.message }), { status: 500 });
    }
    excluded = new Set((mealRows ?? []).map((r) => r.user_id as string));
  }

  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth');
  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });
  }

  const targets = (subs ?? []).filter((s) => {
    const uid = s.user_id as string;
    if (plannedToday && !plannedToday.has(uid)) return false;
    return !excluded.has(uid);
  });

  if (dryRun) {
    return new Response(JSON.stringify({
      type: isGymPlan ? 'gymPlan' : 'meal', category: category ?? null, today,
      totalSubscriptions: subs?.length ?? 0, targetCount: targets.length,
      targetUserIds: targets.map((t) => t.user_id),
    }), { headers: { 'content-type': 'application/json' } });
  }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );

  const payload = JSON.stringify(isGymPlan
    ? {
        title: 'FitMealTracker',
        body: '🏋️ 今日はジムの日と宣言しています！まだ記録がありません💪',
        tag: 'gym-plan-reminder',
      }
    : {
        title: 'FitMealTracker',
        body: `${REMINDER_LABEL[category!]}！今日の${category}をまだ記録していません。`,
        tag: `meal-reminder-${category}`,
      });

  let sent = 0;
  const staleIds: string[] = [];
  const errors: string[] = [];

  await Promise.all(targets.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        payload,
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        staleIds.push(sub.id as string);
      } else {
        errors.push(`${sub.id}: ${(err as Error).message ?? err}`);
      }
    }
  }));

  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }

  return new Response(JSON.stringify({
    type: isGymPlan ? 'gymPlan' : 'meal', category: category ?? null, today,
    targetCount: targets.length, sent, staleRemoved: staleIds.length, errors,
  }), { headers: { 'content-type': 'application/json' } });
});
