'use client';

import { useEffect } from 'react';
import { useMealData } from '@/hooks/useMealData';
import { checkAndNotify, registerMealReminderSW } from '@/lib/mealReminder';

export default function MealReminderScheduler() {
  const { meals } = useMealData();

  // SW を一度だけ登録
  useEffect(() => {
    registerMealReminderSW();
  }, []);

  // 毎分チェック（タブが開いているとき）
  useEffect(() => {
    const tick = () => { checkAndNotify(meals); };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [meals]);

  return null;
}
