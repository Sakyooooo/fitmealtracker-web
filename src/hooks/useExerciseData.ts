'use client';

import { useAppDataContext } from '@/store/AppDataProvider';

/** 運動データへのアクセス。実体は AppDataProvider の単一ストア。 */
export function useExerciseData() {
  const { exercises, hydrated, addExercise, updateExercise, deleteExercise, prependExercise } =
    useAppDataContext();
  return { exercises, hydrated, addExercise, updateExercise, deleteExercise, prependExercise };
}
