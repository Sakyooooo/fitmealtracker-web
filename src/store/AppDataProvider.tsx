'use client';

/**
 * アプリ全体で共有する単一のデータストア。
 *
 * 以前は useMealData / useExerciseData / useWeightData / useSettings / useAppData が
 * それぞれ独立に localStorage を読み込む「多重インスタンス」構成で、
 * 画面間で状態がズレる問題があった（例: タブを開いたまま日中に記録した食事が
 * 深夜0時の振り返りに含まれない、記録済みでもリマインダーが鳴る）。
 *
 * 本 Provider を ClientLayout で1回だけマウントし、各 useXxx フックは
 * この Context への薄いセレクタとして同じ API を返す（呼び出し側は無変更）。
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
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
  bulkImportMeals,
  bulkImportExercises,
  loadSettings,
  saveSettings,
} from '@/lib/localRepository';
import {
  sbUpsertMeal, sbDeleteMeal, sbUploadMealPhoto, sbFetchMyMeals,
  sbUpsertExercise, sbDeleteExercise, sbFetchMyExercises,
  sbUpsertWeight, sbDeleteWeight, sbFetchMyWeights,
  sbUpsertGymSession, sbDeleteGymSession,
} from '@/lib/supabaseRepository';
import { ensureAuthUserId, syncUserToSupabase } from '@/lib/identity';
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

export type AppDataStore = {
  meals: MealEntry[];
  exercises: ExerciseEntry[];
  weights: WeightEntry[];
  settings: AppSettings;
  gymSession: GymSession | null;
  hydrated: boolean;
  addMeal: (data: NewMealData) => Promise<void>;
  updateMeal: (updated: MealEntry) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  addExercise: (data: Omit<ExerciseEntry, 'id' | 'date'> & { date?: string }) => Promise<void>;
  updateExercise: (updated: ExerciseEntry) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  prependExercise: (exercise: ExerciseEntry) => void;
  addWeight: (data: Omit<WeightEntry, 'id'>) => Promise<void>;
  deleteWeight: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  startGym: () => Promise<void>;
  endGym: () => void;
  cancelGym: () => void;
  updateGymMemo: (memo: string) => void;
  saveGymAsExercise: (calories: number) => void;
};

const AppDataContext = createContext<AppDataStore | null>(null);

export function useAppDataContext(): AppDataStore {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppDataContext は <AppDataProvider> の内側でのみ使用できます');
  }
  return ctx;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  // settings は同期読みできるので初回レンダーから実値を返す（表示のチラつき防止）
  const [settings, setSettings] = useState<AppSettings>(() =>
    typeof window !== 'undefined' ? loadSettings() : {},
  );
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
    revokePhotoUrls();
    setHydrated(false);
    const [m, e, w, gs] = await Promise.all([
      fetchMeals(),
      fetchExercises(),
      fetchWeights(),
      fetchActiveGymSession(),
    ]);
    photoUrlsRef.current = m.flatMap((meal) => (meal.photoUri ? [meal.photoUri] : []));
    setMeals(m);
    setExercises(e);
    setWeights(w);
    setGymSession(gs);
    setSettings(loadSettings());
    setHydrated(true);

    // ── Supabase から本人の記録を取得してローカルへマージ（端末間同期・復元） ──
    (async () => {
      // 本人IDを確定し、users 行が無ければ作成する。
      // これを常駐 Provider で行うことで、どの画面から使い始めても
      // meals/exercises の同期が FK 違反（users 行なし）にならないようにする。
      const uid = await ensureAuthUserId();
      await syncUserToSupabase(uid);

      const [remoteM, remoteE, remoteW] = await Promise.all([
        sbFetchMyMeals(),
        sbFetchMyExercises(),
        sbFetchMyWeights(),
      ]);

      // 食事: ローカルに無い分（＝他端末で記録した分）だけ state 末尾へ追加。
      // リモートの食事は photoUrl（Storage 公開URL）を持ち photoId は無いため、
      // object URL を新規生成しない → photoUrlsRef の追跡は不要。
      if (remoteM) {
        const localIds = new Set(m.map((x) => x.id));
        const newOnes = remoteM.filter((x) => !localIds.has(x.id));
        if (newOnes.length > 0) {
          await bulkImportMeals(remoteM); // ローカルに無い分だけ永続化（内部でdedup）
          setMeals((prev) => {
            const ids = new Set(prev.map((x) => x.id));
            return [...prev, ...newOnes.filter((x) => !ids.has(x.id))];
          });
        }
      }

      // 運動: 同様にローカルに無い分だけ追加。
      if (remoteE) {
        const localIds = new Set(e.map((x) => x.id));
        const newOnes = remoteE.filter((x) => !localIds.has(x.id));
        if (newOnes.length > 0) {
          await bulkImportExercises(remoteE);
          setExercises((prev) => {
            const ids = new Set(prev.map((x) => x.id));
            return [...prev, ...newOnes.filter((x) => !ids.has(x.id))];
          });
        }
      }

      // 体重: id union でマージし日付降順に並べ替え。
      if (remoteW && remoteW.length > 0) {
        const merged = mergeWeights(w, remoteW);
        if (merged.length !== w.length) {
          await bulkImportWeights(remoteW);
          setWeights(merged);
        }
      }
    })().catch(console.error);
  }, []);

  useEffect(() => {
    loadAll();
    return () => { revokePhotoUrls(); };
  }, [loadAll]);

  // ── 食事 ─────────────────────────────────────────────────────────────────────
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
      console.error('[AppData] addMeal', error);
      alert(error instanceof Error ? error.message : '食事の保存に失敗しました。');
    }
  }, []);

  const updateMeal = useCallback(async (updated: MealEntry) => {
    try {
      const saved = await updateStoredMeal(updated);
      setMeals((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      sbUpsertMeal(saved).catch(console.error);
    } catch (error) {
      console.error('[AppData] updateMeal', error);
      alert('食事の更新に失敗しました。');
    }
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    await deleteStoredMeal(id);
    sbDeleteMeal(id).catch(console.error);
  }, []);

  // ── 運動 ─────────────────────────────────────────────────────────────────────
  const addExercise = useCallback(async (
    data: Omit<ExerciseEntry, 'id' | 'date'> & { date?: string },
  ) => {
    try {
      const saved = await insertExercise({ ...data, date: data.date ?? todayString() });
      setExercises((prev) => [saved, ...prev]);
      sbUpsertExercise(saved).catch(console.error);
    } catch (error) {
      console.error('[AppData] addExercise', error);
      alert(error instanceof Error ? error.message : '運動の保存に失敗しました。');
    }
  }, []);

  const updateExercise = useCallback(async (updated: ExerciseEntry) => {
    try {
      const saved = await updateStoredExercise(updated);
      setExercises((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      sbUpsertExercise(saved).catch(console.error);
    } catch (error) {
      console.error('[AppData] updateExercise', error);
      alert('運動の更新に失敗しました。');
    }
  }, []);

  const deleteExercise = useCallback(async (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    await deleteStoredExercise(id);
    sbDeleteExercise(id).catch(console.error);
  }, []);

  /** 保存済みの運動レコードを state 先頭に足す（ジムセッション完了フローなどで使用）。 */
  const prependExercise = useCallback((exercise: ExerciseEntry) => {
    setExercises((prev) => [exercise, ...prev]);
    sbUpsertExercise(exercise).catch(console.error);
  }, []);

  // ── 体重 ─────────────────────────────────────────────────────────────────────
  const addWeight = useCallback(async (data: Omit<WeightEntry, 'id'>) => {
    try {
      const saved = await insertWeight(data);
      setWeights((prev) => [saved, ...prev]);
      sbUpsertWeight(saved).catch(console.error);
    } catch (error) {
      console.error('[AppData] addWeight', error);
      alert(error instanceof Error ? error.message : '体重の保存に失敗しました。');
    }
  }, []);

  const deleteWeight = useCallback(async (id: string) => {
    setWeights((prev) => prev.filter((w) => w.id !== id));
    await deleteStoredWeight(id);
    sbDeleteWeight(id).catch(console.error);
  }, []);

  // ── 設定 ─────────────────────────────────────────────────────────────────────
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // ── ジムセッション ───────────────────────────────────────────────────────────
  const startGym = useCallback(async () => {
    try {
      const saved = await insertGymSession(new Date().toISOString());
      setGymSession(saved);
      sbUpsertGymSession(saved).catch(console.error);
    } catch (error) {
      console.error('[AppData] startGym', error);
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

  const store: AppDataStore = {
    meals, exercises, weights, settings, gymSession, hydrated,
    addMeal, updateMeal, deleteMeal,
    addExercise, updateExercise, deleteExercise, prependExercise,
    addWeight, deleteWeight,
    updateSettings,
    startGym, endGym, cancelGym, updateGymMemo, saveGymAsExercise,
  };

  return <AppDataContext.Provider value={store}>{children}</AppDataContext.Provider>;
}
