'use client';

import { useState, useCallback } from 'react';
import { AppSettings } from '@/lib/types';
import { loadSettings, saveSettings } from '@/lib/localRepository';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() =>
    typeof window !== 'undefined' ? loadSettings() : {},
  );

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
