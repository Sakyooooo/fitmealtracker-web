'use client';

/**
 * 友達タブ「ジム」: 週間ジム宣言（旧🌏Worldタブの置き換え）。
 *
 * - 上段: 自分の宣言カード。曜日チップをタップして「行く日」を宣言。
 *   実績は exercises(type='gymSession') から自動判定され、緑✅が付く。
 * - 下段: フレンドの今週（宣言と実績のミニドット）。宣言が見えることが
 *   お互いの緩い強制力になる。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FriendPerson } from '@/lib/types';
import {
  fetchGymWeekData, upsertMyPlan, getCachedMyPlan, jstTodayIndex,
  type GymWeekData,
} from '@/lib/gymPlans';

const ACCENT = '#AB47BC';
const DONE = '#4CAF50';
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

type Props = {
  meId: string;
  people: FriendPerson[]; // 自分＋フレンド（自分が先頭）
  onSelectPerson?: (p: FriendPerson) => void;
};

export default function GymPlanTab({ meId, people, onSelectPerson }: Props) {
  const [myDays, setMyDays] = useState<number[]>(getCachedMyPlan);
  const [week, setWeek] = useState<GymWeekData | null>(null);
  const todayIdx = jstTodayIndex();

  const realIds = useMemo(() => people.map((p) => p.id).filter(isUuid), [people]);

  useEffect(() => {
    let alive = true;
    fetchGymWeekData(realIds).then((data) => {
      if (!alive) return;
      setWeek(data);
      if (data.plans[meId]) setMyDays(data.plans[meId]);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realIds.join(','), meId]);

  const myDone = week?.doneDays[meId] ?? new Set<number>();
  const achieved = myDays.filter((d) => myDone.has(d)).length;

  const toggleDay = useCallback((idx: number) => {
    setMyDays((prev) => {
      const next = prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort();
      upsertMyPlan(next).then(({ error }) => {
        if (error) console.error('[GymPlanTab] upsertMyPlan:', error);
      });
      return next;
    });
  }, []);

  const friends = people.filter((p) => !p.isMe);

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      {/* ── 自分の宣言カード ── */}
      <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-gray-900">今週のジム宣言</p>
          {myDays.length > 0 && (
            <span
              className="text-[11px] font-black px-2.5 py-1 rounded-full"
              style={{ background: '#F3E8FF', color: ACCENT }}
            >
              {achieved}/{myDays.length} 達成
            </span>
          )}
        </div>

        <div className="flex justify-between gap-1">
          {DAY_LABELS.map((label, idx) => {
            const planned = myDays.includes(idx);
            const done = myDone.has(idx);
            const isToday = idx === todayIdx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx)}
                className="flex flex-col items-center gap-1 flex-1"
                aria-label={`${label}曜日${planned ? 'の宣言を解除' : 'に行くと宣言'}`}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all"
                  style={done
                    ? { background: DONE, color: '#fff' }
                    : planned
                      ? { background: '#F3E8FF', color: ACCENT, boxShadow: `inset 0 0 0 2px ${ACCENT}` }
                      : { background: '#F9FAFB', color: '#D1D5DB', boxShadow: isToday ? 'inset 0 0 0 1.5px #E5E7EB' : 'none' }}
                >
                  {done ? '✓' : label}
                </span>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: isToday ? ACCENT : '#C4C8CF' }}
                >
                  {isToday ? '今日' : label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-gray-300 font-bold mt-3">
          タップで行く日を宣言。ジムを記録すると自動でチェックが付き、フレンドにも見えます。
        </p>
      </div>

      {/* ── みんなの今週 ── */}
      <p className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2">みんなの今週</p>

      {friends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-3">🏋️</span>
          <p className="text-sm font-bold text-gray-400">フレンドがいません</p>
          <p className="text-xs text-gray-300 mt-1">フレンドを追加すると<br />お互いの宣言が見えます</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
          {friends.map((p) => {
            const plan = week?.plans[p.id] ?? [];
            const done = week?.doneDays[p.id] ?? new Set<number>();
            const achievedCount = plan.filter((d) => done.has(d)).length;
            const initial = p.name.charAt(0).toUpperCase();
            const hasAny = plan.length > 0 || done.size > 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPerson?.(p)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: '#F3E8FF' }}
                >
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black" style={{ color: ACCENT }}>{initial}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-gray-900 truncate">{p.name}</p>
                  {hasAny ? (
                    <div className="flex gap-1 mt-1.5">
                      {DAY_LABELS.map((_, idx) => {
                        const d = done.has(idx);
                        const pl = plan.includes(idx);
                        return (
                          <span
                            key={idx}
                            className="w-3.5 h-3.5 rounded-full"
                            style={d
                              ? { background: DONE }
                              : pl
                                ? { boxShadow: `inset 0 0 0 1.5px ${ACCENT}` }
                                : { boxShadow: 'inset 0 0 0 1px #E5E7EB' }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-300 font-bold mt-0.5">今週はまだ宣言していません</p>
                  )}
                </div>

                {plan.length > 0 && (
                  <span className="text-xs font-black text-gray-400 flex-shrink-0 tabular-nums">
                    {achievedCount}/{plan.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 凡例 */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: DONE }} /> 行った
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ boxShadow: `inset 0 0 0 1.5px ${ACCENT}` }} /> 宣言
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ boxShadow: 'inset 0 0 0 1px #E5E7EB' }} /> 予定なし
        </span>
      </div>
    </div>
  );
}
