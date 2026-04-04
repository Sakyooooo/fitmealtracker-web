/**
 * constants/activities.ts
 *
 * 運動種目マスタデータ。
 * 消費カロリー推定係数（kcal/分、体重60kg想定の概算）を保持する。
 *
 * 将来の拡張ポイント:
 *   - ユーザーの体重を使った MET 計算: kcal/分 = MET × weightKg × 3.5 / 200
 *   - 外部APIやサーバーからの種目リスト取得
 *   - METs値の追加（種目ごとに intensity レベルを定義）
 */

export type ActivityRate = {
  /** 表示名（日本語） */
  name: string;
  /** 推定消費カロリー係数 (kcal/分、体重60kg想定) */
  kcalPerMin: number;
};

/** 種目マスタ */
export const ACTIVITY_LIST: ActivityRate[] = [
  { name: 'ジョギング',       kcalPerMin: 8.5  },
  { name: 'ランニング',       kcalPerMin: 11.0 },
  { name: 'ウォーキング',     kcalPerMin: 4.0  },
  { name: 'サイクリング',     kcalPerMin: 7.0  },
  { name: '水泳',             kcalPerMin: 9.0  },
  { name: '筋トレ',           kcalPerMin: 5.5  },
  { name: 'ストレッチ',       kcalPerMin: 2.5  },
  { name: 'ヨガ',             kcalPerMin: 3.0  },
  { name: '縄跳び',           kcalPerMin: 10.0 },
  { name: 'ジムセッション',   kcalPerMin: 6.0  },
];

/** 種目名のみの配列（サジェスト・バリデーション用） */
export const KNOWN_ACTIVITIES: string[] = ACTIVITY_LIST.map((a) => a.name);

/** 種目名 → kcal/分 の辞書（カロリー推定用） */
export const ACTIVITY_RATES: Record<string, number> = Object.fromEntries(
  ACTIVITY_LIST.map((a) => [a.name, a.kcalPerMin]),
);

/** 不明な種目のデフォルト係数 */
export const DEFAULT_ACTIVITY_RATE = 5.0;
