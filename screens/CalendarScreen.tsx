import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import {
  getMealsByDate,
  getExercisesByDate,
  sumCalories,
  sumBurned,
  dateString,
  todayString,
} from '../utils/stats';
import { CalendarStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<CalendarStackParamList, 'CalendarHome'>;
};

const DAYS = ['日', '月', '火', '水', '木', '金', '土'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { meals, exercises } = useAppContext();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(todayString());

  function goToPrevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else { setMonth((m) => m - 1); }
  }

  function goToNextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else { setMonth((m) => m + 1); }
  }

  const todayStr = todayString();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function handleDayPress(day: number) {
    const d = new Date(year, month, day);
    const dStr = dateString(d);
    setSelectedDateStr(dStr);
    navigation.navigate('DayDetail', { date: dStr });
  }

  return (
    <View style={styles.container}>
      <View style={styles.calendarCard}>
        {/* Month navigation header */}
        <View style={styles.monthHeader}>
          <TouchableOpacity style={styles.navBtn} onPress={goToPrevMonth}>
            <Ionicons name="chevron-back" size={22} color="#4CAF50" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{year}年{month + 1}月</Text>
          <TouchableOpacity style={styles.navBtn} onPress={goToNextMonth}>
            <Ionicons name="chevron-forward" size={22} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        <View style={styles.daysHeader}>
          {DAYS.map((d, i) => (
            <Text key={i} style={[styles.dayLabel, i === 0 && styles.sun, i === 6 && styles.sat]}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;

            const dStr = dateString(new Date(year, month, day));
            const isSelectedDay = dStr === selectedDateStr;
            const isTodayCell = dStr === todayStr;

            const dayMeals = getMealsByDate(meals, dStr);
            const dayExercises = getExercisesByDate(exercises, dStr);
            const intakeKcal = sumCalories(dayMeals);
            const burnedKcal = sumBurned(dayExercises);

            return (
              <TouchableOpacity key={i} style={styles.cell} onPress={() => handleDayPress(day)}>
                <View
                  style={[
                    styles.dayCircle,
                    isTodayCell && styles.todayCircle,
                    isSelectedDay && !isTodayCell && styles.selectedCircle,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      isTodayCell && styles.todayNumber,
                      isSelectedDay && !isTodayCell && styles.selectedNumber,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                <View style={styles.kcalArea}>
                  {intakeKcal > 0 && (
                    <Text style={styles.kcalMeal}>食 {intakeKcal}</Text>
                  )}
                  {burnedKcal > 0 && (
                    <Text style={styles.kcalBurned}>消 {burnedKcal}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={[styles.legendSwatch, { backgroundColor: '#4CAF50' }]} />
        <Text style={styles.legendText}>{t('calendar.mealLabel')}</Text>
        <View style={[styles.legendSwatch, { backgroundColor: '#FF7043' }]} />
        <Text style={styles.legendText}>{t('calendar.exerciseLabel')}　{t('calendar.tapForDetail')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 16 },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 18, backgroundColor: '#F5F5F5',
  },
  monthLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  daysHeader: { flexDirection: 'row' },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: '#888', paddingBottom: 8 },
  sun: { color: '#E53935' },
  sat: { color: '#1E88E5' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 2 },
  dayCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  todayCircle: { backgroundColor: '#4CAF50' },
  selectedCircle: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  dayNumber: { fontSize: 13, color: '#333' },
  todayNumber: { color: '#fff', fontWeight: 'bold' },
  selectedNumber: { color: '#4CAF50', fontWeight: '600' },
  kcalArea: { alignItems: 'center', minHeight: 24 },
  kcalMeal: { fontSize: 9, color: '#4CAF50', fontWeight: '600', lineHeight: 12 },
  kcalBurned: { fontSize: 9, color: '#FF7043', fontWeight: '600', lineHeight: 12 },
  legendRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, marginLeft: 4, gap: 6,
  },
  legendSwatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 12, color: '#888', marginRight: 8 },
});
