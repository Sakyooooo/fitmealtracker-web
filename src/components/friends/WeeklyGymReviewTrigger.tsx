'use client';

/**
 * 週の初め（新しい週を最初に開いたとき）に1回、先週の振り返り＋今週の目標
 * ポップアップを自動表示する。DailyRecapAutoTrigger と同じ「1回だけ表示」パターン。
 */

import { useEffect, useState } from 'react';
import { supabaseEnabled } from '@/lib/supabase';
import { ensureAuthUserId, needsIdentityGate } from '@/lib/identity';
import {
  currentWeekStart, previousWeekStart,
  getWeeklyReviewShownWeek, setWeeklyReviewShownWeek,
  fetchGymWeekData,
} from '@/lib/gymPlans';
import WeeklyGymReviewModal from './WeeklyGymReviewModal';

export default function WeeklyGymReviewTrigger() {
  const [open, setOpen] = useState(false);
  const [lastWeekPlanned, setLastWeekPlanned] = useState<number[]>([]);
  const [lastWeekDone, setLastWeekDone] = useState<Set<number>>(new Set());
  const [initialDays, setInitialDays] = useState<number[]>([]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let alive = true;

    (async () => {
      const thisWeek = currentWeekStart();
      if (getWeeklyReviewShownWeek() === thisWeek) return;
      // 復元ゲートが出ている最中は表示しない（未解決なら次回起動時に再判定される）
      if (await needsIdentityGate()) return;

      const uid = await ensureAuthUserId();
      const lastWeek = previousWeekStart();
      const [lastData, thisData] = await Promise.all([
        fetchGymWeekData([uid], lastWeek),
        fetchGymWeekData([uid], thisWeek),
      ]);
      if (!alive) return;

      setLastWeekPlanned(lastData.plans[uid] ?? []);
      setLastWeekDone(lastData.doneDays[uid] ?? new Set());
      setInitialDays(thisData.plans[uid] ?? []);

      setWeeklyReviewShownWeek(thisWeek); // 表示前にマーク（多重表示防止）
      setTimeout(() => { if (alive) setOpen(true); }, 600);
    })();

    return () => { alive = false; };
  }, []);

  return (
    <WeeklyGymReviewModal
      open={open}
      onClose={() => setOpen(false)}
      lastWeekPlanned={lastWeekPlanned}
      lastWeekDone={lastWeekDone}
      initialDays={initialDays}
    />
  );
}
