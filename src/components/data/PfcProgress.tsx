'use client';

type ItemProps = {
  label: string;
  actual: number;
  target: number;
  color: string;
  unit: string;
};

function PfcItem({ label, actual, target, color, unit }: ItemProps) {
  const pct = target > 0 ? Math.min(actual / target, 1) : 0;
  const achieved = actual >= target;
  const barColor = achieved ? '#4CAF50' : '#FF9800';

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>
          {actual}{unit} / {target}{unit}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-xs text-right mt-0.5" style={{ color: barColor }}>
        {Math.round(pct * 100)}%
      </p>
    </div>
  );
}

type Props = {
  todayProtein: number;
  todayFat: number;
  todayCarbs: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  hasTodayPfc: boolean;
  onEdit: () => void;
};

export default function PfcProgress({
  todayProtein, todayFat, todayCarbs,
  targetProtein, targetFat, targetCarbs,
  hasTodayPfc, onEdit,
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700">今日の栄養素 vs 目標</h2>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs px-3 py-1 rounded-lg bg-green-50 text-[#4CAF50] border border-[#4CAF50] font-semibold hover:bg-green-100 transition-colors"
        >
          目標設定
        </button>
      </div>
      {hasTodayPfc ? (
        <div className="divide-y divide-gray-50">
          <PfcItem label="🟦 タンパク質" actual={todayProtein} target={targetProtein} color="#1E88E5" unit="g" />
          <PfcItem label="🟨 脂質"       actual={todayFat}     target={targetFat}     color="#F9A825" unit="g" />
          <PfcItem label="🟩 炭水化物"   actual={todayCarbs}   target={targetCarbs}   color="#4CAF50" unit="g" />
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-4 leading-relaxed">
          今日の食事記録にPFCデータがありません。<br />
          食事追加時に写真解析または手動入力で栄養素を記録してください。
        </p>
      )}
      <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">
        目標: P {targetProtein}g / F {targetFat}g / C {targetCarbs}g
      </p>
    </div>
  );
}
