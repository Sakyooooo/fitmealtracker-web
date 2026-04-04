/**
 * services/exercise.ts
 *
 * 運動量からの消費カロリー推定ロジック。
 * 種目マスタデータは constants/activities.ts に分離済み。
 *
 * 将来の拡張ポイント:
 *   - HealthKit / Google Fit から実測値を取得する場合はここを差し替える
 *   - ユーザーの体重情報を使った MET 計算に差し替え可能
 */

import {
  ACTIVITY_RATES,
  DEFAULT_ACTIVITY_RATE,
  KNOWN_ACTIVITIES,
} from '../constants/activities';

// 後方互換のため再エクスポート
export { KNOWN_ACTIVITIES };

/**
 * 種目名と時間から消費カロリーを推定する。
 *
 * @param activityName - 種目名（種目マスタに一致する名前を部分一致で検索）
 * @param durationMinutes - 運動時間（分）
 * @param _weightKg - 体重（kg）。現時点は未使用。将来の MET 計算用に予約
 * @returns 推定消費カロリー（kcal、整数）
 */
export function estimateExerciseCalories(
  activityName: string,
  durationMinutes: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _weightKg?: number,
): number {
  // 種目マスタを部分一致で検索
  const matched = Object.entries(ACTIVITY_RATES).find(([key]) =>
    activityName.includes(key) || key.includes(activityName),
  );
  const rate = matched ? matched[1] : DEFAULT_ACTIVITY_RATE;
  return Math.round(rate * durationMinutes);
}
