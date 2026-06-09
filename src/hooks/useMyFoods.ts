'use client';

import { useState, useEffect, useCallback } from 'react';
import { MyFood } from '@/lib/types';
import {
  fetchMyFoodsLocal,
  saveMyFoodsLocal,
  upsertMyFoodLocal,
  deleteMyFoodLocal,
  newMyFoodId,
} from '@/lib/localRepository';
import { sbUpsertMyFood, sbDeleteMyFood, sbFetchMyFoods } from '@/lib/supabaseRepository';

type NewMyFood = Omit<MyFood, 'id' | 'createdAt' | 'updatedAt'>;

/** id をキーに updatedAt が新しい方を採用してマージ。 */
function mergeByNewest(a: MyFood[], b: MyFood[]): MyFood[] {
  const map = new Map<string, MyFood>();
  for (const f of [...a, ...b]) {
    const prev = map.get(f.id);
    if (!prev || new Date(f.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) {
      map.set(f.id, f);
    }
  }
  return Array.from(map.values()).sort(
    (x, y) => new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime(),
  );
}

export function useMyFoods() {
  const [myFoods, setMyFoods] = useState<MyFood[]>([]);

  // ① ローカル即時表示 → ② Supabase から取得してマージ（端末間同期）
  useEffect(() => {
    const local = fetchMyFoodsLocal();
    setMyFoods(local);
    (async () => {
      const remote = await sbFetchMyFoods();
      if (!remote) return;
      const merged = mergeByNewest(local, remote);
      saveMyFoodsLocal(merged);
      setMyFoods(merged);
    })().catch(console.error);
  }, []);

  const addMyFood = useCallback((data: NewMyFood): MyFood => {
    const now = new Date().toISOString();
    const food: MyFood = { ...data, id: newMyFoodId(), createdAt: now, updatedAt: now };
    setMyFoods(upsertMyFoodLocal(food));
    sbUpsertMyFood(food).catch(console.error);
    return food;
  }, []);

  const deleteMyFood = useCallback((id: string) => {
    setMyFoods(deleteMyFoodLocal(id));
    sbDeleteMyFood(id).catch(console.error);
  }, []);

  return { myFoods, addMyFood, deleteMyFood };
}
