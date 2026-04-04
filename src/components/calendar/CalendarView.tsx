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
                className="border-b border-r border-gray-50 h-16"
              />
            );
          }

          const pad = (n: number) => String(n).padStart(2, '0');
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const dayMeals = getMealsByDate(meals, dateStr);
          const dayExercises = getExercisesByDate(exercises, dateStr);
          const intake = sumCalories(dayMeals);
          const burned = sumBurned(dayExercises);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const dow = (startDow + day - 1) % 7;

          return (
            <button
              key={day}
              onClick={() => onSelectDate(dateStr)}
              className={`border-b border-r border-gray-50 h-16 flex flex-col items-center pt-1 px-0.5 transition-colors ${
                isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
              }`}
            >
              <span
                className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-[#4CAF50] text-white'
                    : dow === 0
                    ? 'text-red-400'
                    : dow === 6
                    ? 'text-blue-400'
                    : 'text-gray-700'
                }`}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
