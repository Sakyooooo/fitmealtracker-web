export type ActivityRate = {
  name: string;
  kcalPerMin: number;
};

export const ACTIVITY_LIST: ActivityRate[] = [
  { name: 'ジョギング',     kcalPerMin: 8.5  },
  { name: 'ランニング',     kcalPerMin: 11.0 },
  { name: 'ウォーキング',   kcalPerMin: 4.0  },
  { name: 'サイクリング',   kcalPerMin: 7.0  },
  { name: '水泳',           kcalPerMin: 9.0  },
  { name: '筋トレ',         kcalPerMin: 5.5  },
  { name: 'ストレッチ',     kcalPerMin: 2.5  },
  { name: 'ヨガ',           kcalPerMin: 3.0  },
  { name: '縄跳び',         kcalPerMin: 10.0 },
  { name: 'ジムセッション', kcalPerMin: 6.0  },
  { name: 'その他',         kcalPerMin: 5.0  },
];

export const KNOWN_ACTIVITIES = ACTIVITY_LIST.map((a) => a.name);

export const ACTIVITY_RATES: Record<string, number> = Object.fromEntries(
  ACTIVITY_LIST.map((a) => [a.name, a.kcalPerMin]),
);

export const DEFAULT_ACTIVITY_RATE = 5.0;

export const DEFAULT_PRESETS = [
  'ランニング', 'ウォーキング', '筋トレ',
  '水泳', 'サイクリング', 'ヨガ', 'その他',
];

export function estimateExerciseCalories(name: string, durationMinutes: number): number {
  const matched = Object.entries(ACTIVITY_RATES).find(
    ([key]) => name.includes(key) || key.includes(name),
  );
  const rate = matched ? matched[1] : DEFAULT_ACTIVITY_RATE;
  return Math.round(rate * durationMinutes);
}
