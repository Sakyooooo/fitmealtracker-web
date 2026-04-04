'use client';

import { WeightEntry, AppSettings } from '@/lib/types';
import { calcBMI, bmiCategory } from '@/lib/stats';

type Props = {
  weights: WeightEntry[];
  settings: AppSettings;
};

export default function WeightSummaryCard({ weights, settings }: Props) {
  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const previous = sorted[1];

  const diff =
    latest && previous
      ? Math.round((latest.weightKg - previous.weightKg) * 10) / 10
      : null;

  const bmi =
    latest && settings.heightCm
      ? calcBMI(latest.weightKg, settings.heightCm)
      : null;
  const bmiInfo = bmi !== null ? bmiCategory(bmi) : null;

  const target = settings.targetWeightKg;
  const remaining =
    latest && target
      ? Math.round((latest.weightKg - target) * 10) / 10
      : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
      <p className="text-xs text-gray-500 mb-1">最新の体重</p>

      {latest ? (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-gray-800">
              {latest.weightKg.toFixed(1)}
            </span>
            <span className="text-sm text-gray-500">kg</span>
            {diff !== null && (
              <span
                className={`text-sm font-semibold ml-1 ${
                  diff < 0 ? 'text-[#4CAF50]' : diff > 0 ? 'text-[#EF5350]' : 'text-gray-400'
                }`}
              >
                {diff > 0 ? `+${diff}` : diff} kg
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">{latest.date}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* BMI */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">BMI</p>
              {bmi !== null && bmiInfo ? (
                <>
                  <p className="text-xl font-bold text-gray-800">{bmi}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: bmiInfo.color }}>
                    {bmiInfo.label}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-300">身長を設定してください</p>
              )}
            </div>

            {/* Target */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">目標体重</p>
              {target ? (
                <>
                  <p className="text-xl font-bold text-gray-800">{target.toFixed(1)} kg</p>
                  <p
                    className={`text-xs font-medium mt-0.5 ${
                      remaining !== null && remaining <= 0
                        ? 'text-[#4CAF50]'
                        : 'text-gray-500'
                    }`}
                  >
                    {remaining !== null
                      ? remaining <= 0
                        ? '🎉 目標達成！'
                        : `あと ${remaining} kg`
                      : '—'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-300">未設定</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 py-2">まだ記録がありません</p>
      )}
    </div>
  );
}
