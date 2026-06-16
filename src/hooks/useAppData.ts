'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MealEntry, ExerciseEntry, WeightEntry, AppSettings, GymSession } from '@/lib/types';
import {
  fetchMeals,
  insertMeal,
  updateMeal as updateStoredMeal,
  deleteMeal as deleteStoredMeal,
  fetchExercises,
  insertExercise,
  updateExercise as updateStoredExercise,
  deleteExercise as deleteStoredExercise,
  fetchWeights,
  insertWeight,
  deleteWeight as deleteStoredWeight,
  fetchActiveGymSession,
  insertGymSession,
  updateGymSession,
  deleteGymSession,
  bulkImportWeights,
  loadSettings,
  saveSettings,
} from '@/lib/localRepository';
import {
  sbUpsertMeal, sbDeleteMeal, sbUploadMealPhoto,
  sbUpsertExercise, sbDeleteExercise,
  sbUpsertWeight, sbDeleteWeight, sbFetchMyWeights,
  sbUpsertGymSession, sbDeleteGymSession,
} from '@/lib/supabaseRepository';
import { todayString } from '@/lib/stats';

/** id をキーに union（端末間で増えた体重をマージ）。日付の新しい順に並べる。 */
function mergeWeights(local: WeightEntry[], remote: WeightEntry[]): WeightEntry[] {
  const map = new Map<string, WeightEntry>();
  for (const w of [...local, ...remote]) map.set(w.id, w);
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

type NewMealData = Omit<MealEntry, 'id' | 'date' | 'photoUri' | 'photoId'> & {
  date?: string;
  photoFile?: File | null;
};

export function useAppData() {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [gymSession, setGymSession] = useState<GymSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // IndexedDB 画像の object URL を追跡して revoke する
  const photoUrlsRef = useRef<string[]>([]);

  function revokePhotoUrls() {
    photoUrlsRef.current.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    });
    photoUrlsRef.current = [];
  }

  const loadAll = useCallback(async () => {
    // 前回ロード時に作成した object URL を解放
    revokePhotoUrls();
    setHydrated(false);
    const [m, e, w, gs] = await Promise.all([
      fetchMeals(),
      fetchExercises(),
      fetchWeights(),
      fetchActiveGymSession(),
    ]);
    // 新しく作られた photo URL を追跡
    photoUrlsRef.current = m.flatMap((meal) => (meal.photoUri ? [meal.photoUri] : []));
    setMeals(m);
    setExercises(e);
    setWeights(w);
    setGymSession(gs);
    setSettings(loadSettings());
    setHydrated(true);

    // Supabase から本人の体重を取得してマージ（別端末・再インストール後の復元）
    (async () => {
      const remoteW = await sbFetchMyWeights();
      if (remoteW && remoteW.length > 0) {
        const merged = mergeWeights(w, remoteW);
        if (merged.length !== w.length) {
          await bulkImportWeights(remoteW); // ローカルに無い分だけ追記
          setWeights(merged);
        }
      }
    })().catch(console.error);
  }, []);

  useEffect(() => {
    loadAll();
    // アンマウント時にすべての object URL を解放
    return () => { revokePhotoUrls(); };
  }, [loadAll]);

  const addMeal = useCallback(async (data: NewMealData) => {
    try {
      const saved = await insertMeal({ ...data, date: data.date ?? todayString() });
      if (saved.photoUri) photoUrlsRef.current.push(saved.photoUri);
      setMeals((prev) => [saved, ...prev]);
      // Supabase に非同期で同期（写真があれば Storage にアップロードして photo_url を付与）
      (async () => {
        let photoUrl: string | undefined;
        if (data.photoFile) {
          photoUrl = (await sbUploadMealPhoto(saved.id, data.photoFile)) ?? undefined;
        }
        await sbUpsertMeal({ ...saved, photoUrl });
      })().catch(console.error);
    } catch (error) {
      console.error('[local] insert meal failed', error);
      alert('食事の保存に失敗しました。もう一度お試しください。');
    }
  }, []);

  const updateMeal = useCallback(async (updated: MealEntry) => {
    try {
      const saved = await updateStoredMeal(updated);
      setMeals((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      sbUpsertMeal(saved).catch(console.error);
    } catch (error) {
      console.error('[local] update meal failed', error);
      alert('食事の更新に失敗しました。');
    }
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    await deleteStoredMeal(id);
    sbDeleteMeal(id).catch(console.error);
  }, []);

  const addExercise = useCallback(async (
    data: Omit<ExerciseEntry, 'id' | 'date'> & { date?: string },
  ) => {
    try {
      const saved = await insertExercise({ ...data, date: data.date ?? todayString() });
      setExercises((prev) => [saved, ...prev]);
      sbUpsertExercise(saved).catch(console.error);
    } catch (error) {
      console.error('[local] insert exercise failed', error);
      alert('運動の保存に失敗しました。もう一度お試しください。');
    }
  }, []);

  const updateExercise = useCallback(async (updated: ExerciseEntry) => {
    try {
      const saved = await updateStoredExercise(updated);
      setExercises((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      sbUpsertExercise(saved).catch(console.error);
    } catch (error) {
      console.error('[local] update exercise failed', error);
      alert('運動の更新に失敗しました。');
    }
  }, []);

  const deleteExercise = useCallback(async (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    await deleteStoredExercise(id);
    sbDeleteExercise(id).catch(console.error);
  }, []);

  const addWeight = useCallback(async (data: Omit<WeightEntry, 'id'>) => {
    try {
      const saved = await insertWeight(data);
      setWeights((prev) => [saved, ...prev]);
      sbUpsertWeight(saved).catch(console.error);
    } catch (error) {
      console.error('[local] insert weight failed', error);
      alert('体重の保存に失敗しました。もう一度お試しください。');
    }
  }, []);

  const deleteWeight = useCallback(async (id: string) => {
    setWeights((prev) => prev.filter((w) => w.id !== id));
    await deleteStoredWeight(id);
    sbDeleteWeight(id).catch(console.error);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const startGym = useCallback(async () => {
    try {
      const saved = await insertGymSession(new Date().toISOString());
      setGymSession(saved);
      sbUpsertGymSession(saved).catch(console.error);
    } catch (error) {
      console.error('[local] start gym failed', error);
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
      sbUpsertGymSession(next).catch(console.error);
      return next;
    });
  }, []);

  const cancelGym = useCallback(() => {
    setGymSession((prev) => {
      if (prev) {
        deleteGymSession(prev.id).catch(console.error);
        sbDeleteGymSession(prev.id).catch(console.error);
      }
      return null;
    });
  }, []);

  const updateGymMemo = useCallback((memo: string) => {
    setGymSession((prev) => {
      if (!prev) return prev;
      const next: GymSession = { ...prev, memo };
      updateGymSession(next).catch((e) => console.error('memo sync failed', e));
      sbUpsertGymSession(next).catch(console.error);
      return next;
    });
  }, []);

  const saveGymAsExercise = useCallback((calories: number) => {
    setGymSession((prev) => {
      if (!prev || prev.status !== 'completed') return prev;
      const durationMin = Math.round((prev.durationSec ?? 0) / 60);
      const exerciseData: Omit<ExerciseEntry, 'id'> = {
        name: 'ジムセッション',
        durationMinutes: durationMin > 0 ? durationMin : 1,
        caloriesBurned: calories,
        date: prev.startedAt.slice(0, 10),
        note: prev.memo ?? '',
        type: 'gymSession',
      };
      // deleteGymSession は insertExercise 成功後にのみ実行
      // （保存失敗でセッションが消えるのを防ぐ）
      insertExercise(exerciseData)
        .then((saved) => {
          setExercises((ex) => [saved, ...ex]);
          sbUpsertExercise(saved).catch(console.error);
          sbDeleteGymSession(prev.id).catch(console.error);
          return deleteGymSession(prev.id);
        })
        .catch((err) => {
          console.error('[saveGymAsExercise] 運動記録の保存に失敗しました', err);
          alert('ジムセッションの保存に失敗しました。もう一度お試しください。');
          // 失敗時はセッションを completed 状態に戻す
          setGymSession(prev);
        });
      return null;
    });
  }, []);

  return {
    meals, exercises, weights, settings, gymSession, hydrated,
    addMeal, updateMeal, deleteMeal,
    addExercise, updateExercise, deleteExercise,
    addWeight, deleteWeight,
    updateSettings,
    startGym, endGym, cancelGym, updateGymMemo, saveGymAsExercise,
  };
}
