'use client';

import { useState, useEffect, useCallback } from 'react';
import { WeightEntry } from '@/lib/types';
import {
  fetchWeights,
  insertWeight,
  deleteWeight as deleteStoredWeight,
} from '@/lib/localRepository';

export function useWeightData() {
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    fetchWeights().then((w) => { setWeights(w); setHydrated(true); });
  }, []);

  const addWeight = useCallback(async (data: Omit<WeightEntry, 'id'>) => {
    try {
      const saved = await insertWeight(data);
      setWeights((prev) => [saved, ...prev]);
    } catch (error) {
      console.error('[useWeightData] addWeight', error);
      alert(error instanceof Error ? error.message : '体重の保存に失敗しました。');
    }
  }, []);

  const deleteWeight = useCallback(async (id: string) => {
    setWeights((prev) => prev.filter((w) => w.id !== id));
    await deleteStoredWeight(id);
  }, []);

  return { weights, hydrated, addWeight, deleteWeight };
}
