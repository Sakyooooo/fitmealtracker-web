'use client';

import { useState, useEffect, useCallback } from 'react';
import { WeightEntry } from '@/lib/types';
import {
  fetchWeights,
  insertWeight,
  deleteWeight as deleteStoredWeight,
  bulkImportWeights,
} from '@/lib/localRepository';
import { sbUpsertWeight, sbDeleteWeight, sbFetchMyWeights } from '@/lib/supabaseRepository';

/** id をキーに union（端末間で増えた体重をマージ）。日付の新しい順に並べる。 */
function mergeWeights(local: WeightEntry[], remote: WeightEntry[]): WeightEntry[] {
  const map = new Map<string, WeightEntry>();
  for (const w of [...local, ...remote]) map.set(w.id, w);
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function useWeightData() {
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // ① ローカル即時表示 → ② Supabase から取得してマージ（端末間同期・復元）
  useEffect(() => {
    fetchWeights().then((local) => {
      setWeights(local);
      setHydrated(true);
      (async () => {
        const remote = await sbFetchMyWeights();
        if (remote && remote.length > 0) {
          const merged = mergeWeights(local, remote);
          if (merged.length !== local.length) {
            await bulkImportWeights(remote);
            setWeights(merged);
          }
        }
      })().catch(console.error);
    });
  }, []);

  const addWeight = useCallback(async (data: Omit<WeightEntry, 'id'>) => {
    try {
      const saved = await insertWeight(data);
      setWeights((prev) => [saved, ...prev]);
      sbUpsertWeight(saved).catch(console.error);
    } catch (error) {
      console.error('[useWeightData] addWeight', error);
      alert(error instanceof Error ? error.message : '体重の保存に失敗しました。');
    }
  }, []);

  const deleteWeight = useCallback(async (id: string) => {
    setWeights((prev) => prev.filter((w) => w.id !== id));
    await deleteStoredWeight(id);
    sbDeleteWeight(id).catch(console.error);
  }, []);

  return { weights, hydrated, addWeight, deleteWeight };
}
