/**
 * サインイン完了後のデータ引き継ぎ・同期。
 *
 * /auth/callback から呼ばれ、前回 identity（getLastIdentity）と比較して:
 *  - uid 不変（＝匿名の昇格）        → ダウンロード同期のみ（実質何も変わらない）
 *  - 前回が匿名で uid が変わった     → ローカル記録をID再発行して新アカウントへ
 *                                      アップロード（引き継ぎ）＋ダウンロード同期
 *  - 前回が連携済み別アカウント      → ダウンロードのみ（別人のデータを誤って
 *                                      新アカウントへ混ぜないための安全側の既定）
 */

import { supabaseEnabled } from './supabase';
import {
  STORAGE_KEY_IDENTITY_MODE,
  STORAGE_KEY_LAST_IDENTITY,
} from './constants';
import { getLastIdentity, syncUserToSupabase } from './identity';
import {
  syncDownAllFromSupabase, migrateLocalToSupabase,
  sbUpsertWeight, sbUpsertMyFood, sbUpsertRecipe, sbFetchRecipes,
  sbUploadMealPhoto,
} from './supabaseRepository';
import {
  reissueAllRecordIds, fetchRecipesLocal, saveRecipesLocal,
} from './localRepository';
import { getStoredImage } from './imageStore';
import { MealEntry } from './types';

/** サインイン直後のマージ同期。結果の要約文（トースト表示用）を返す。 */
export async function mergeAfterSignIn(uid: string, isAnonymous: boolean): Promise<string> {
  if (!supabaseEnabled) return '同期はオフです（Supabase未設定）';

  // users 行が無いと meals 等のアップロードが FK 違反になるため先に確定させる
  await syncUserToSupabase(uid);

  const prev = getLastIdentity();
  let upCount = 0;
  if (prev && prev.uid !== uid && prev.anonymous) {
    upCount = await uploadLocalUnderNewIds();
  }

  const down = await syncDownAllFromSupabase();
  const recipeCount = await downSyncRecipes();

  try {
    localStorage.setItem(STORAGE_KEY_LAST_IDENTITY, JSON.stringify({ uid, anonymous: isAnonymous }));
    localStorage.setItem(STORAGE_KEY_IDENTITY_MODE, isAnonymous ? 'anonymous' : 'authed');
  } catch { /* quota */ }

  const parts = [
    `食事${down.meals}`, `運動${down.exercises}`, `体重${down.weights}`,
    `マイ食品${down.myFoods}`, `レシピ${recipeCount}`,
  ];
  if (upCount > 0) parts.push(`引き継ぎ${upCount}`);
  return `同期しました（${parts.join(' / ')}）`;
}

/** 設定画面の「今すぐ再同期」用（ダウンロードのみ）。 */
export async function resyncNow(): Promise<string> {
  if (!supabaseEnabled) return '同期はオフです（Supabase未設定）';
  const down = await syncDownAllFromSupabase();
  const recipeCount = await downSyncRecipes();
  return `再同期しました（食事${down.meals} / 運動${down.exercises} / 体重${down.weights} / マイ食品${down.myFoods} / レシピ${recipeCount}）`;
}

/**
 * ローカル全記録をID再発行して現アカウントへアップロードする。
 * 写真がIndexedDBに残っていればStorageへ再アップロードして photo_url も引き継ぐ。
 */
async function uploadLocalUnderNewIds(): Promise<number> {
  const { meals, exercises, weights, myFoods, recipes } = reissueAllRecordIds();

  const mealsForUpload: MealEntry[] = [];
  for (const m of meals) {
    let photoUrl: string | undefined;
    if (m.photoId) {
      const img = await getStoredImage(m.photoId).catch(() => null);
      if (img) {
        const file = new File([img.blob], `${m.id}.jpg`, { type: img.mimeType || 'image/jpeg' });
        photoUrl = (await sbUploadMealPhoto(m.id, file)) ?? undefined;
      }
    }
    mealsForUpload.push(photoUrl ? { ...m, photoUrl } : m);
  }

  await migrateLocalToSupabase(mealsForUpload, exercises);
  for (const w of weights) await sbUpsertWeight(w);
  for (const f of myFoods) await sbUpsertMyFood(f);
  for (const r of recipes) await sbUpsertRecipe(r);

  return meals.length + exercises.length + weights.length + myFoods.length + recipes.length;
}

/** レシピのダウンロード同期（syncDownAllFromSupabase の対象外のため個別に）。 */
async function downSyncRecipes(): Promise<number> {
  const remote = await sbFetchRecipes();
  if (!remote) return 0;
  const local = fetchRecipesLocal();
  const ids = new Set(local.map((r) => r.id));
  const newOnes = remote.filter((r) => !ids.has(r.id));
  if (newOnes.length > 0) saveRecipesLocal([...newOnes, ...local]);
  return remote.length;
}
