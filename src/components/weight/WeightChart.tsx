'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { WeightEntry, AppSettings } from '@/lib/types';

type Props = {
  weights: WeightEntry[];
  settings: AppSettings;
};

export default function WeightChart({ weights, settings }: Props) {
  const sorted = [...weights]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  if (sorted.length < 2) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 flex items-center justify-center h-32">
        <p className="text-sm text-gray-300">2件以上記録するとグラフが表示されます</p>
      </div>
    );
  }

  const data = sorted.map((w) => ({
    date: w.date.slice(5), // MM-DD
    weight: w.weightKg,
  }));

  const allWeights = data.map((d) => d.weight);
  const minW = Math.floor(Math.min(...allWeights) - 1);
  const maxW = Math.ceil(Math.max(...allWeights) + 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <h2 className="text-sm font-bold text-gray-700 mb-3">体重推移（直近30件）</h2>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9E9E9E' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minW, maxW]}
            tick={{ fontSize: 10, fill: '#9E9E9E' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            formatter={(value: number) => [`${value} kg`, '体重']}
            labelFormatter={(label) => label}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #E0E0E0',
            }}
          />
          {settings.targetWeightKg && (
            <ReferenceLine
              y={settings.targetWeightKg}
              stroke="#4CAF50"
              strokeDasharray="4 4"
              label={{ value: '目標', position: 'right', fontSize: 10, fill: '#4CAF50' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#42A5F5"
            strokeWidth={2}
            dot={{ r: 3, fill: '#42A5F5' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
