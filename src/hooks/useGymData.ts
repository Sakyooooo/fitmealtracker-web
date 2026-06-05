'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GymSession, ExerciseEntry } from '@/lib/types';
import {
  fetchActiveGymSession,
  insertGymSession,
  updateGymSession,
  deleteGymSession,
  insertExercise,
} from '@/lib/localRepository';

type Options = {
  /** ジムセッションを運動記録として保存した際に呼ばれるコールバック */
  onExerciseSaved: (exercise: ExerciseEntry) => void;
};

export function useGymData({ onExerciseSaved }: Options) {
  const [gymSession, setGymSession] = useState<GymSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // stale closure 対策: 最新の session を ref で保持
  const gymSessionRef = useRef(gymSession);
  useEffect(() => { gymSessionRef.current = gymSession; }, [gymSession]);

  useEffect(() => {
    fetchActiveGymSession().then((gs) => { setGymSession(gs); setHydrated(true); });
  }, []);

  const startGym = useCallback(async () => {
    try {
      const saved = await insertGymSession(new Date().toISOString());
      setGymSession(saved);
    } catch (error) {
      console.error('[useGymData] startGym', error);
      alert('ジムセッションの開始に失敗しました。');
    }
  }, []);

  const endGym = useCallback(() => {
    setGymSession((prev) => {
      if (!prev || prev.status !== 'active') return prev;
      const endedAt = new Date().toISOString();
      const durationSec = Math.floor(
        (new Date(endedAt).getTime() - new Date(prev.startedAt).getTime()) / 1000,
      );
      const next: GymSession = { ...prev, endedAt, durationSec, status: 'completed' };
      updateGymSession(next).catch((e) => console.error('endGym sync failed', e));
      return next;
    });
  }, []);

  const cancelGym = useCallback(() => {
    setGymSession((prev) => {
      if (prev) deleteGymSession(prev.id).catch(console.error);
      return null;
    });
  }, []);

  const updateGymMemo = useCallback((memo: string) => {
    setGymSession((prev) => {
      if (!prev) return prev;
      const next: GymSession = { ...prev, memo };
      updateGymSession(next).catch((e) => console.error('memo sync failed', e));
      return next;
    });
  }, []);

  const saveGymAsExercise = useCallback(async (calories: number) => {
    const session = gymSessionRef.current;
    if (!session || session.status !== 'completed') return;

    const durationMin = Math.round((session.durationSec ?? 0) / 60);
    const exerciseData: Omit<ExerciseEntry, 'id'> = {
      name: 'ジムセッション',
      durationMinutes: durationMin > 0 ? durationMin : 1,
      caloriesBurned: calories,
      date: session.startedAt.slice(0, 10),
      note: session.memo ?? '',
      type: 'gymSession',
    };

    try {
      // 運動記録の保存に成功してから session を削除する
      const saved = await insertExercise(exerciseData);
      onExerciseSaved(saved);
      await deleteGymSession(session.id);
      setGymSession(null);
    } catch (err) {
      console.error('[useGymData] saveGymAsExercise failed', err);
      alert(err instanceof Error ? err.message : 'ジムセッションの保存に失敗しました。もう一度お試しください。');
    }
  }, [onExerciseSaved]);

  return { gymSession, hydrated, startGym, endGym, cancelGym, updateGymMemo, saveGymAsExercise };
}
