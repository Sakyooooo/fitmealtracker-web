'use client';

type Props = {
  burned: number;
  target?: number;
};

export default function ExerciseSummaryCard({ burned, target }: Props) {
  const pct = target ? Math.min((burned / target) * 100, 100) : null;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
      <p className="text-xs text-gray-500 mb-1">本日の消費カロリー</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-4xl font-bold text-[#FF7043]">{burned.toLocaleString()}</span>
        <span className="text-sm text-gray-500">kcal</span>
        {target && (
          <span className="text-xs text-gray-400 ml-auto">目標 {target.toLocaleString()} kcal</span>
        )}
      </div>
      {pct !== null && (
        <div className="mt-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#FF7043] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{Math.round(pct)}% 達成</p>
        </div>
      )}
    </div>
  );
}
