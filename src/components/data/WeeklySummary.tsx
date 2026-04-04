'use client';

import { DayStat } from '@/lib/types';

type Props = {
  stats: DayStat[];
  streak: number;
};

export default function WeeklySummary({ stats, streak }: Props) {
  const totalCalories = stats.reduce((s, d) => s + d.calories, 0);
  const totalBurned = stats.reduce((s, d) => s + d.burned, 0);
  const avgCalories = Math.round(totalCalories / 7);
  const avgBurned = Math.round(totalBurned / 7);
  const avgNet = avgCalories - avgBurned;
  const activeDays = stats.filter((d) => d.calories > 0 || d.burned > 0).length;

  const rows = [
    { label: '平均摂取カロリー', value: `${avgCalories} kcal`, sub: '/ 日' },
    { label: '平均消費カロリー', value: `${avgBurned} kcal`, sub: '/ 日' },
    { label: '平均純カロリー', value: `${avgNet} kcal`, sub: '/ 日' },
    { label: '記録日数', value: `${activeDays} 日`, sub: '/ 7日' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <h2 className="text-sm font-bold text-gray-700 mb-1">週間サマリー（直近7日）</h2>
      <div>
        {rows.map((row, i) => (
          <div key={row.label}>
            {i > 0 && <div className="h-px bg-gray-50" />}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-500">{row.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold text-gray-800">{row.value}</span>
                <span className="text-xs text-gray-400">{row.sub}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="h-px bg-gray-50" />
        <div className="flex items-center justify-between py-2.5">
          <span className="text-sm text-gray-500">🔥 連続記録</span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-sm font-semibold ${streak >= 3 ? 'text-[#FF7043]' : 'text-gray-800'}`}
            >
              {streak} 日
            </span>
            {streak >= 3 && (
              <span className="text-xs text-[#FF7043]">継続中！</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
