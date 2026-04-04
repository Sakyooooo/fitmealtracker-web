import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MealEntry, ExerciseEntry, GymSession, WeightEntry, AppSettings } from '../types';
import { INITIAL_MEALS, INITIAL_EXERCISES } from '../data/initialData';
import { dateString } from '../utils/stats';
import {
  saveMeals,
  loadMeals,
  saveExercises,
  loadExercises,
  saveActiveGymSession,
  loadActiveGymSession,
  saveWeights,
  loadWeights,
  saveSettings,
  loadSettings,
  isFirstLaunch,
  markInitialized,
} from '../services/storage';

type AppContextType = {
  meals: MealEntry[];
  exercises: ExerciseEntry[];
  weights: WeightEntry[];
  settings: AppSettings;
  activeGymSession: GymSession | null;
  isLoading: boolean;
  addMeal: (meal: Omit<MealEntry, 'id'>) => void;
  updateMeal: (meal: MealEntry) => void;
  deleteMeal: (mealId: string) => void;
  addExercise: (exercise: Omit<ExerciseEntry, 'id'>) => void;
  updateExercise: (exercise: ExerciseEntry) => void;
  deleteExercise: (exerciseId: string) => void;
  startGymSession: () => void;
  endGymSession: (calories: number, note: string) => void;
  cancelGymSession: () => void;
  addWeight: (entry: Omit<WeightEntry, 'id'>) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [activeGymSession, setActiveGymSession] = useState<GymSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Initialize from AsyncStorage ─────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const firstLaunch = await isFirstLaunch();
        if (firstLaunch) {
          setMeals(INITIAL_MEALS);
          setExercises(INITIAL_EXERCISES);
          await Promise.all([
            saveMeals(INITIAL_MEALS),
            saveExercises(INITIAL_EXERCISES),
            markInitialized(),
          ]);
        } else {
          const [storedMeals, storedExercises, storedGym, storedWeights, storedSettings] =
            await Promise.all([
              loadMeals(),
              loadExercises(),
              loadActiveGymSession(),
              loadWeights(),
              loadSettings(),
            ]);
          if (storedMeals) setMeals(storedMeals);
          if (storedExercises) setExercises(storedExercises);
          if (storedGym) setActiveGymSession(storedGym);
          setWeights(storedWeights);
          setSettings(storedSettings);
        }
      } catch (e) {
        console.warn('AppContext init error:', e);
        setMeals(INITIAL_MEALS);
        setExercises(INITIAL_EXERCISES);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // ─── Meal actions ─────────────────────────────────────────────────────────

  function addMeal(meal: Omit<MealEntry, 'id'>) {
    setMeals((prev) => {
      const updated = [...prev, { ...meal, id: `m${Date.now()}` }];
      saveMeals(updated);
      return updated;
    });
  }

  function updateMeal(meal: MealEntry) {
    setMeals((prev) => {
      const updated = prev.map((m) => (m.id === meal.id ? meal : m));
      saveMeals(updated);
      return updated;
    });
  }

  function deleteMeal(mealId: string) {
    setMeals((prev) => {
      const updated = prev.filter((m) => m.id !== mealId);
      saveMeals(updated);
      return updated;
    });
  }

  // ─── Exercise actions ─────────────────────────────────────────────────────

  function addExercise(exercise: Omit<ExerciseEntry, 'id'>) {
    setExercises((prev) => {
      const updated = [...prev, { ...exercise, id: `e${Date.now()}` }];
      saveExercises(updated);
      return updated;
    });
  }

  function updateExercise(exercise: ExerciseEntry) {
    setExercises((prev) => {
      const updated = prev.map((e) => (e.id === exercise.id ? exercise : e));
      saveExercises(updated);
      return updated;
    });
  }

  function deleteExercise(exerciseId: string) {
    setExercises((prev) => {
      const updated = prev.filter((e) => e.id !== exerciseId);
      saveExercises(updated);
      return updated;
    });
  }

  // ─── Gym session actions ──────────────────────────────────────────────────

  function startGymSession() {
    const session: GymSession = {
      id: `gym${Date.now()}`,
      startedAt: new Date().toISOString(),
      note: '',
      status: 'active',
    };
    setActiveGymSession(session);
    saveActiveGymSession(session);
  }

  function endGymSession(calories: number, note: string) {
    setActiveGymSession((current) => {
      if (!current) return null;

      const endedAt = new Date().toISOString();
      const durationMs = new Date(endedAt).getTime() - new Date(current.startedAt).getTime();
      const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

      const gymExercise: ExerciseEntry = {
        id: `e${Date.now()}`,
        name: 'ジムセッション',
        durationMinutes,
        caloriesBurned: calories,
        date: dateString(new Date(current.startedAt)),
        note,
        type: 'gymSession',
      };

      setExercises((prev) => {
        const updated = [...prev, gymExercise];
        saveExercises(updated);
        return updated;
      });

      saveActiveGymSession(null);
      return null;
    });
  }

  function cancelGymSession() {
    setActiveGymSession(null);
    saveActiveGymSession(null);
  }

  // ─── Weight actions ───────────────────────────────────────────────────────

  function addWeight(entry: Omit<WeightEntry, 'id'>) {
    setWeights((prev) => {
      const updated = [...prev, { ...entry, id: `w${Date.now()}` }];
      saveWeights(updated);
      return updated;
    });
  }

  // ─── Settings actions ─────────────────────────────────────────────────────

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((prev) => {
      const updated = { ...prev, ...patch };
      saveSettings(updated);
      return updated;
    });
  }

  return (
    <AppContext.Provider
      value={{
        meals,
        exercises,
        weights,
        settings,
        activeGymSession,
        isLoading,
        addMeal,
        updateMeal,
        deleteMeal,
        addExercise,
        updateExercise,
        deleteExercise,
        startGymSession,
        endGymSession,
        cancelGymSession,
        addWeight,
        updateSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
