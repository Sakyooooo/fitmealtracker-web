'use client';

import { useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import CalendarView from '@/components/calendar/CalendarView';
import DayDetailModal from '@/components/calendar/DayDetailModal';

export default function CalendarPage() {
  const { meals, exercises, hydrated } = useAppData();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        読み込み中...
      </div>
    );
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold text-gray-800 mb-4">カレンダー</h1>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:bg-gray-50 text-lg"
        >
          ‹
        </button>
        <span className="text-base font-bold text-gray-700">
          {year}年 {month}月
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:bg-gray-50 text-lg"
        >
          ›
        </button>
      </div>

      <CalendarView
        meals={meals}
        exercises={exercises}
        year={year}
        month={month}
        selectedDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date)}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4CAF50] flex-shrink-0" />
          <span className="text-xs text-gray-400">食（摂取kcal）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF7043] flex-shrink-0" />
          <span className="text-xs text-gray-400">消（消費kcal）</span>
        </div>
        <span className="text-xs text-gray-300 ml-auto">日付をクリックで詳細</span>
      </div>

      {selectedDate && (
        <DayDetailModal
          open={true}
          onClose={() => setSelectedDate(null)}
          date={selectedDate}
          meals={meals}
          exercises={exercises}
        />
      )}
    </main>
  );
}
