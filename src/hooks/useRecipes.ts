'use client';

import { useState, useEffect, useCallback } from 'react';
import { Recipe } from '@/lib/types';
import {
  fetchRecipesLocal,
  saveRecipesLocal,
  upsertRecipeLocal,
  deleteRecipeLocal,
  newRecipeId,
} from '@/lib/localRepository';
import { sbUpsertRecipe, sbDeleteRecipe, sbFetchRecipes } from '@/lib/supabaseRepository';

export type NewRecipe = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;

/** id をキーに updatedAt が新しい方を採用してマージ。 */
function mergeByNewest(a: Recipe[], b: Recipe[]): Recipe[] {
  const map = new Map<string, Recipe>();
  for (const r of [...a, ...b]) {
    const prev = map.get(r.id);
    if (!prev || new Date(r.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) {
      map.set(r.id, r);
    }
  }
  return Array.from(map.values()).sort(
    (x, y) => new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime(),
  );
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // ① ローカル即時表示 → ② Supabase から取得してマージ（端末間同期）
  useEffect(() => {
    const local = fetchRecipesLocal();
    setRecipes(local);
    (async () => {
      const remote = await sbFetchRecipes();
      if (!remote) return;
      const merged = mergeByNewest(local, remote);
      saveRecipesLocal(merged);
      setRecipes(merged);
    })().catch(console.error);
  }, []);

  const addRecipe = useCallback((data: NewRecipe): Recipe => {
    const now = new Date().toISOString();
    const recipe: Recipe = { ...data, id: newRecipeId(), createdAt: now, updatedAt: now };
    setRecipes(upsertRecipeLocal(recipe));
    sbUpsertRecipe(recipe).catch(console.error);
    return recipe;
  }, []);

  const updateRecipe = useCallback((recipe: Recipe) => {
    const next: Recipe = { ...recipe, updatedAt: new Date().toISOString() };
    setRecipes(upsertRecipeLocal(next));
    sbUpsertRecipe(next).catch(console.error);
  }, []);

  const deleteRecipe = useCallback((id: string) => {
    setRecipes(deleteRecipeLocal(id));
    sbDeleteRecipe(id).catch(console.error);
  }, []);

  return { recipes, addRecipe, updateRecipe, deleteRecipe };
}
