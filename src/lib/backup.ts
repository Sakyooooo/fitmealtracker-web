'use client';

/**
 * データ保全: 完全バックアップの作成・復元と「バックアップ推奨」判定。
 *
 * localStorage（記録・設定・マイ食品）と IndexedDB（食事写真）を
 * 1つの JSON にまとめてダウンロードし、後から無劣化で復元できる。
 * 記録はブラウザ都合で消え得るため、定期的なバックアップを促す。
 */

import {
  AppSettings,
  ExerciseEntry,
  MealEntry,
  MyFood,
  WeightEntry,
} from './types';
import {
  bulkImportExercises,
  bulkImportMeals,
  bulkImportMyFoods,
  bulkImportWeights,
  fetchExercises,
  fetchMealsRaw,
  fetchMyFoodsLocal,
  fetchWeights,
  loadSettings,
  saveSettings,
} from './localRepository';
import { getStoredImage, importImage } from './imageStore';

export type BackupPhoto = {
  id: string;
  mimeType: string;
  createdAt: string;
  dataUrl: string;
};

export type FullBackup = {
  app: 'FitMealTracker';
  format: 'full-backup';
  version: 1;
  exportedAt: string;
  meals: MealEntry[];
  exercises: ExerciseEntry[];
  weights: WeightEntry[];
  settings: AppSettings;
  myFoods: MyFood[];
  photos: BackupPhoto[];
};

export type RestoreSummary = {
  meals: number;
  exercises: number;
  weights: number;
  myFoods: number;
  photos: number;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function stripPhotoUri(meal: MealEntry): MealEntry {
  const rest = { ...meal };
  delete rest.photoUri;
  return rest;
}

// ── 作成 ──────────────────────────────────────────────────────────────────────
export async function createFullBackup(): Promise<FullBackup> {
  const meals = fetchMealsRaw().map(stripPhotoUri);
  const [exercises, weights] = await Promise.all([fetchExercises(), fetchWeights()]);

  const photos: BackupPhoto[] = [];
  for (const meal of meals) {
    if (!meal.photoId) continue;
    try {
      const image = await getStoredImage(meal.photoId);
      if (!image) continue;
      photos.push({
        id: image.id,
        mimeType: image.mimeType,
        createdAt: image.createdAt,
        dataUrl: await blobToDataUrl(image.blob),
      });
    } catch {
      // 写真が読めなくても記録本体のバックアップは続行する
    }
  }

  return {
    app: 'FitMealTracker',
    format: 'full-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    meals,
    exercises,
    weights,
    settings: loadSettings(),
    myFoods: fetchMyFoodsLocal(),
    photos,
  };
}

// ── 復元 ──────────────────────────────────────────────────────────────────────
export function isFullBackup(data: unknown): data is FullBackup {
  if (!data || typeof data !== 'object') return false;
  const b = data as Partial<FullBackup>;
  return b.app === 'FitMealTracker' && b.format === 'full-backup' && Array.isArray(b.meals);
}

/** 重複（同じ id）は自動スキップ。設定はローカル側を優先しつつ欠けを補完する。 */
export async function restoreFullBackup(backup: FullBackup): Promise<RestoreSummary> {
  await bulkImportMeals(Array.isArray(backup.meals) ? backup.meals.map(stripPhotoUri) : []);
  await bulkImportExercises(Array.isArray(backup.exercises) ? backup.exercises : []);
  await bulkImportWeights(Array.isArray(backup.weights) ? backup.weights : []);
  bulkImportMyFoods(Array.isArray(backup.myFoods) ? backup.myFoods : []);

  if (backup.settings && typeof backup.settings === 'object') {
    saveSettings({ ...backup.settings, ...loadSettings() });
  }

  let photoCount = 0;
  for (const photo of Array.isArray(backup.photos) ? backup.photos : []) {
    try {
      await importImage({
        id: photo.id,
        blob: await dataUrlToBlob(photo.dataUrl),
        mimeType: photo.mimeType,
        createdAt: photo.createdAt,
      });
      photoCount++;
    } catch {
      // 1枚の失敗で全体を止めない
    }
  }

  return {
    meals: backup.meals?.length ?? 0,
    exercises: backup.exercises?.length ?? 0,
    weights: backup.weights?.length ?? 0,
    myFoods: backup.myFoods?.length ?? 0,
    photos: photoCount,
  };
}

// ── バックアップ推奨判定 ──────────────────────────────────────────────────────
const META_KEY = 'fmt_backup_meta';
const DUE_AFTER_DAYS = 7;
const MIN_RECORDS_FOR_REMINDER = 5;

type BackupMeta = { lastBackupAt: string; totalAtBackup: number };

function loadMeta(): BackupMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as BackupMeta) : null;
  } catch {
    return null;
  }
}

export function markBackupDone(totalRecords: number): void {
  localStorage.setItem(
    META_KEY,
    JSON.stringify({ lastBackupAt: new Date().toISOString(), totalAtBackup: totalRecords } satisfies BackupMeta),
  );
}

export type BackupStatus = {
  lastBackupAt: string | null;
  daysSince: number | null;
  due: boolean;
};

/** totalRecords = 食事+運動+体重の合計件数 */
export function getBackupStatus(totalRecords: number): BackupStatus {
  const meta = loadMeta();
  if (!meta) {
    return {
      lastBackupAt: null,
      daysSince: null,
      due: totalRecords >= MIN_RECORDS_FOR_REMINDER,
    };
  }
  const days = Math.floor((Date.now() - new Date(meta.lastBackupAt).getTime()) / 86_400_000);
  return {
    lastBackupAt: meta.lastBackupAt,
    daysSince: days,
    due: days >= DUE_AFTER_DAYS && totalRecords > meta.totalAtBackup,
  };
}
