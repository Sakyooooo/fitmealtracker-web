'use client';

import { useState, useEffect } from 'react';
import { supabaseEnabled } from '@/lib/supabase';
import { migrateLocalToSupabase } from '@/lib/supabaseRepository';
import { fetchMeals } from '@/lib/localRepository';
import { fetchExercises } from '@/lib/localRepository';
import { STORAGE_KEY_MIGRATION_DONE } from '@/lib/constants';

type State = 'idle' | 'running' | 'done' | 'error';

export default function MigrationBanner() {
  const [show, setShow] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      supabaseEnabled &&
      !localStorage.getItem(STORAGE_KEY_MIGRATION_DONE)
    ) {
      setShow(true);
    }
  }, []);

  async function handleMigrate() {
    setState('running');
    setPct(0);
    const meals = await fetchMeals();
    const exercises = await fetchExercises();

    const ok = await migrateLocalToSupabase(meals, exercises, setPct);
    if (ok) {
      localStorage.setItem(STORAGE_KEY_MIGRATION_DONE, '1');
      setState('done');
      setTimeout(() => setShow(false), 2000);
    } else {
      setState('error');
    }
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY_MIGRATION_DONE, '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <div className="bg-gray-900 text-white rounded-2xl p-4 shadow-xl">

        {state === 'idle' && (
          <>
            <p className="text-sm font-black mb-1">📤 データを同期しますか？</p>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              既存の食事・運動記録を Supabase に移行すると、
              フレンドのタイムラインに表示されます。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 py-2 text-xs font-bold text-gray-400 border border-gray-700 rounded-xl"
              >
                スキップ
              </button>
              <button
                type="button"
                onClick={handleMigrate}
                className="flex-1 py-2 text-xs font-black bg-white text-gray-900 rounded-xl"
              >
                移行する
              </button>
            </div>
          </>
        )}

        {state === 'running' && (
          <>
            <p className="text-sm font-black mb-2">移行中... {pct}%</p>
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}

        {state === 'done' && (
          <p className="text-sm font-black text-center">✅ 移行完了！</p>
        )}

        {state === 'error' && (
          <>
            <p className="text-sm font-black text-red-400 mb-2">⚠️ 移行に失敗しました</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 py-2 text-xs text-gray-400"
              >
                スキップ
              </button>
              <button
                type="button"
                onClick={handleMigrate}
                className="flex-1 py-2 text-xs font-black bg-white text-gray-900 rounded-xl"
              >
                再試行
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
