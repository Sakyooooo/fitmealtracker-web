'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useMealData } from '@/hooks/useMealData';
import { useExerciseData } from '@/hooks/useExerciseData';
import { useSettings } from '@/hooks/useSettings';
import { buildRecapData, getRecapShownDate, setRecapShownDate } from '@/lib/recap';
import DailyRecap from './DailyRecap';

function yesterdayJST(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 「今日のふり返り」を以下のタイミングで 1 日 1 回表示する。
 * 1. 深夜0:00 になった瞬間（タブが開いているとき）
 * 2. 起動時に前日の振り返りをまだ見ていない場合（タブを閉じていて見逃したとき）
 */
export default function DailyRecapAutoTrigger() {
  const { meals, hydrated: mealsReady } = useMealData();
  const { exercises, hydrated: exReady } = useExerciseData();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [targetDate, setTargetDate] = useState(yesterdayJST);
  const shownRef = useRef(false);

  const data = useMemo(
    () => buildRecapData(meals, exercises, settings, targetDate),
    [meals, exercises, settings, targetDate],
  );

  function tryShow(date: string) {
    if (shownRef.current) return;
    if (getRecapShownDate() === date) return;
    shownRef.current = true;
    setTargetDate(date);
    setTimeout(() => {
      setRecapShownDate(date);
      setOpen(true);
    }, 600);
  }

  // ── 起動時チェック: 前日の振り返りを見ていなければ表示 ──────────────────────
  useEffect(() => {
    if (!mealsReady || !exReady) return;
    const yesterday = yesterdayJST();
    const hasRecords =
      meals.some((m) => m.date === yesterday) ||
      exercises.some((e) => e.date === yesterday);
    if (hasRecords) tryShow(yesterday);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealsReady, exReady]);

  // ── 毎分チェック: 深夜0:00 になったら前日ぶんを表示 ────────────────────────
  useEffect(() => {
    if (!mealsReady || !exReady) return;
    const id = setInterval(() => {
      if (currentHHMM() === '00:00') tryShow(yesterdayJST());
    }, 60_000);
    return () => clearInterval(id);
  }, [mealsReady, exReady]);

  return <DailyRecap open={open} data={data} onClose={() => setOpen(false)} />;
}
