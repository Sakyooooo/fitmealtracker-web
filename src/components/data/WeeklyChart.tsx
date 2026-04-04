'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { DayStat } from '@/lib/types';

type Props = { data: DayStat[] };

export default function WeeklyChart({ data }: Props) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <h2 className="text-sm font-bold text-gray-700 mb-3">今週のカロリー推移</h2>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
          <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#888' }} />
          <YAxis tick={{ fontSize: 11, fill: '#888' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E0E0E0' }}
            formatter={(val: number, name: string) => [
              `${val} kcal`,
              name === 'calories' ? '摂取' : '消費',
            ]}
          />
          <Legend
            formatter={(val) => (val === 'calories' ? '摂取' : '消費')}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="calories"
            stroke="#4CAF50"
            strokeWidth={2}
            dot={{ r: 3, fill: '#4CAF50' }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="burned"
            stroke="#FF7043"
            strokeWidth={2}
            dot={{ r: 3, fill: '#FF7043' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
