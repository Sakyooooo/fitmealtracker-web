'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMealData } from '@/hooks/useMealData';
import { useExerciseData } from '@/hooks/useExerciseData';
import { useSettings } from '@/hooks/useSettings';
import { buildRecapData, getRecapShownDate, setRecapShownDate } from '@/lib/recap';
import { todayString } from '@/lib/stats';
import DailyRecap from './DailyRecap';

/**
 * 「今日のふり返り」を 1 日 1 回だけ自動表示する。
 * 条件: 今日の記録が 1 件以上 かつ 今日まだ表示していない。
 * layout 直下にマウントしてアプリ全体で 1 度だけ判定する。
 */
export default function DailyRecapAutoTrigger() {
  const { meals, hydrated: mealsReady } = useMealData();
  const { exercises, hydrated: exReady } = useExerciseData();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);

  const today = todayString();
  const data = useMemo(
    () => buildRecapData(meals, exercises, settings, today),
    [meals, exercises, settings, today],
  );

  const hasRecords = data.records.length > 0;

  useEffect(() => {
    if (!mealsReady || !exReady) return;
    if (!hasRecords) return;
    if (getRecapShownDate() === today) return;

    // 初期描画直後の唐突なポップを避けて少し待つ
    const t = setTimeout(() => {
      setRecapShownDate(today);
      setOpen(true);
    }, 700);
    return () => clearTimeout(t);
  }, [mealsReady, exReady, hasRecords, today]);

  return <DailyRecap open={open} data={data} onClose={() => setOpen(false)} />;
}
