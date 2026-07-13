// FitMealTracker: ジム開始をフレンドへ Web Push で通知
//
// クライアントの「ジム開始(START)」から supabase.functions.invoke で呼ばれる。
// ゲートウェイのJWT検証(既定ON)を通った本人のuidを使い、承認済みフレンドの
// 購読端末へ「🏋️ 〇〇がジムを開始しました！（今週n日目）」を送る。
//
// 必須 secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// （send-reminders と共有。SUPABASE_* は自動注入）

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

function jstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function jstWeekStart(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  return now.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 呼び出し元本人のuidをJWTから確定（なりすまし防止）
  const authHeader = req.headers.get('Authorization') ?? '';
  const authed = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await authed.auth.getUser();
  const uid = userData?.user?.id;
  if (userError || !uid) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 表示名・フレンド・購読・今週の文脈をまとめて取得
  const weekStart = jstWeekStart();
  const [meRes, friendsRes, planRes, doneRes] = await Promise.all([
    admin.from('users').select('display_name, friend_code').eq('id', uid).maybeSingle(),
    admin.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted')
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`),
    admin.from('gym_plans').select('planned_days').eq('user_id', uid).eq('week_start', weekStart).maybeSingle(),
    admin.from('exercises').select('date').eq('user_id', uid).eq('type', 'gymSession')
      .gte('date', weekStart).lte('date', jstToday()),
  ]);

  const name = meRes.data?.display_name ?? meRes.data?.friend_code ?? 'フレンド';
  const friendIds = (friendsRes.data ?? []).map((f) =>
    f.requester_id === uid ? f.receiver_id as string : f.requester_id as string,
  );
  if (friendIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no friends' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', friendIds);
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // 「今週n日目」: 今週のジム実施日数（当日分は未記録のため+1）
  const doneDates = new Set((doneRes.data ?? []).map((r) => r.date as string));
  doneDates.add(jstToday());
  const dayNum = doneDates.size;
  const plannedCount = ((planRes.data?.planned_days as number[] | null) ?? []).length;
  const context = plannedCount > 0 ? `（今週${dayNum}/${plannedCount}日目）` : `（今週${dayNum}日目）`;

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );

  const payload = JSON.stringify({
    title: 'FitMealTracker',
    body: `🏋️ ${name}がジムを開始しました！${context}`,
    tag: `gym-start-${uid}`,
  });

  let sent = 0;
  const staleIds: string[] = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        payload,
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) staleIds.push(sub.id as string);
    }
  }));

  if (staleIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', staleIds);
  }

  return new Response(JSON.stringify({ sent, staleRemoved: staleIds.length }), {
    headers: { 'content-type': 'application/json' },
  });
});
