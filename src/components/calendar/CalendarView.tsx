'use client';

import { MealEntry, ExerciseEntry } from '@/lib/types';
import { getMealsByDate, getExercisesByDate, sumCalories, sumBurned, dateString } from '@/lib/stats';

type Props = {
  meals: MealEntry[];
  exercises: ExerciseEntry[];
  year: number;
  month: number; // 1-12
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
};

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

export default function CalendarView({
  meals, exercises, year, month, onSelectDate, selectedDate,
}: Props) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = dateString(new Date());

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-semibold py-2 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`e-${idx}`}
                className="border-b border-r border-gray-50 h-[68px]"
              />
            );
          }

          const pad = (n: number) => String(n).padStart(2, '0');
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const dayMeals = getMealsByDate(meals, dateStr);
          const dayExercises = getExercisesByDate(exercises, dateStr);
          const intake = sumCalories(dayMeals);
          const burned = sumBurned(dayExercises);
          const photoMeals = dayMeals.filter((m) => m.photoUri);
          const photo = photoMeals[0]?.photoUri;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const dow = (startDow + day - 1) % 7;

          // 日付番号の色（写真なしセル用）
          const numColor = isToday
            ? 'bg-[#4CAF50] text-white'
            : dow === 0
            ? 'text-red-400'
            : dow === 6
            ? 'text-blue-400'
            : 'text-gray-700';

          return (
            <button
              key={day}
              onClick={() => onSelectDate(dateStr)}
              className="relative border-b border-r border-gray-50 h-[68px] overflow-hidden transition-colors hover:bg-gray-50"
            >
              {photo ? (
                /* ── 写真の日: その日の食事写真をタイル表示 ── */
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt=""
                    className="absolute inset-[3px] w-[calc(100%-6px)] h-[calc(100%-6px)] object-cover rounded-lg"
                  />
                  {/* 上部グラデ（番号の視認性確保） */}
                  <div className="absolute inset-[3px] rounded-lg bg-gradient-to-b from-black/55 via-transparent to-transparent pointer-events-none" />
                  {/* 日付番号 */}
                  <span
                    className={`absolute top-1.5 left-1.5 text-[11px] font-bold leading-none ${
                      isToday
                        ? 'w-5 h-5 flex items-center justify-center rounded-full bg-[#4CAF50] text-white'
                        : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
                    }`}
                  >
                    {day}
                  </span>
                  {/* 複数枚のときの枚数バッジ */}
                  {photoMeals.length > 1 && (
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white bg-black/45 rounded px-1 leading-tight">
                      📷{photoMeals.length}
                    </span>
                  )}
                </>
              ) : (
                /* ── 写真なしの日: 日付＋カロリー ── */
                <div className={`flex flex-col items-center pt-1 px-0.5 h-full ${isSelected ? 'bg-green-50' : ''}`}>
                  <span
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${numColor}`}
                  >
                    {day}
                  </span>
                  <div className="flex flex-col items-center mt-0.5 w-full px-0.5 gap-px">
                    {intake > 0 && (
                      <span className="text-[8px] leading-tight font-medium text-[#4CAF50] w-full text-center truncate">
                        食 {intake}
                      </span>
                    )}
                    {burned > 0 && (
                      <span className="text-[8px] leading-tight font-medium text-[#FF7043] w-full text-center truncate">
                        消 {burned}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 選択中の枠線（写真の日も分かるように） */}
              {isSelected && (
                <span className="absolute inset-[3px] rounded-lg ring-2 ring-[#4CAF50] ring-inset pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
