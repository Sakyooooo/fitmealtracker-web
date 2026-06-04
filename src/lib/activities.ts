export type ActivityRate = {
  name: string;
  kcalPerMin: number;
};

export const ACTIVITY_LIST: ActivityRate[] = [
  { name: 'ベンチプレス',       kcalPerMin: 6.0  },
  { name: 'デッドリフト',       kcalPerMin: 7.0  },
  { name: 'スクワット',         kcalPerMin: 7.5  },
  { name: 'ランニング',         kcalPerMin: 11.0 },
  { name: 'クランチ',           kcalPerMin: 4.5  },
  { name: 'レッグプレス',       kcalPerMin: 5.5  },
  { name: 'プルアップ',         kcalPerMin: 8.0  },
  { name: 'バイセップカール',   kcalPerMin: 4.0  },
  { name: 'ダンベルフライ',     kcalPerMin: 5.0  },
  { name: 'プランク',           kcalPerMin: 3.5  },
  { name: 'トライセップディップ', kcalPerMin: 6.0 },
  { name: 'ランジ',             kcalPerMin: 6.5  },
  { name: 'ジョギング',         kcalPerMin: 8.5  },
  { name: 'ウォーキング',       kcalPerMin: 4.0  },
  { name: '水泳',               kcalPerMin: 9.0  },
  { name: 'ジムセッション',     kcalPerMin: 6.0  },
  { name: 'その他',             kcalPerMin: 5.0  },
];

export const KNOWN_ACTIVITIES = ACTIVITY_LIST.map((a) => a.name);

export const ACTIVITY_RATES: Record<string, number> = Object.fromEntries(
  ACTIVITY_LIST.map((a) => [a.name, a.kcalPerMin]),
);

export const DEFAULT_ACTIVITY_RATE = 5.0;

// 12 gym exercises shown in the session picker
export const GYM_PRESETS = [
  'ベンチプレス', 'デッドリフト', 'スクワット', 'ランニング',
  'クランチ', 'レッグプレス', 'プルアップ', 'バイセップカール',
  'ダンベルフライ', 'プランク', 'トライセップディップ', 'ランジ',
];

// All presets for the manual add modal
export const DEFAULT_PRESETS = [
  ...GYM_PRESETS,
  'ジョギング', 'ウォーキング', '水泳', 'その他',
];

export function estimateExerciseCalories(name: string, durationMinutes: number): number {
  const matched = Object.entries(ACTIVITY_RATES).find(
    ([key]) => name.includes(key) || key.includes(name),
  );
  const rate = matched ? matched[1] : DEFAULT_ACTIVITY_RATE;
  return Math.round(rate * durationMinutes);
}
