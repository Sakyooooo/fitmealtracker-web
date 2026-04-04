import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useAppContext } from '../hooks/AppContext';
import { getMealsByDate, getExercisesByDate, sumCalories, sumBurned, sumDuration } from '../utils/stats';
import { CalendarStackParamList } from '../navigation/types';
import { MealEntry, ExerciseEntry } from '../types';

type Props = {
  route: RouteProp<CalendarStackParamList, 'DayDetail'>;
};

const CATEGORY_COLORS: Record<string, string> = {
  朝食: '#FF8F00',
  昼食: '#1E88E5',
  夕食: '#6D4C41',
  間食: '#8E24AA',
};

function parseDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

function MealDetailCard({ meal }: { meal: MealEntry }) {
  return (
    <View style={styles.card}>
      {meal.photoUri && (
        <Image source={{ uri: meal.photoUri }} style={styles.mealPhoto} resizeMode="cover" />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTime}>{meal.time}</Text>
          <View style={[styles.catBadge, { backgroundColor: CATEGORY_COLORS[meal.category] ?? '#888' }]}>
            <Text style={styles.catBadgeText}>{meal.category}</Text>
          </View>
        </View>
        <Text style={styles.cardName}>{meal.name}</Text>
        {meal.note ? <Text style={styles.cardNote}>{meal.note}</Text> : null}
        <Text style={styles.cardCalories}>{meal.calories} kcal</Text>
      </View>
    </View>
  );
}

function ExerciseDetailCard({ exercise }: { exercise: ExerciseEntry }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName}>{exercise.name}</Text>
          {exercise.type === 'gymSession' && (
            <View style={styles.gymBadge}>
              <Text style={styles.gymBadgeText}>ジム</Text>
            </View>
          )}
        </View>
        <View style={styles.exerciseMeta}>
          <Text style={styles.exerciseDetail}>{exercise.durationMinutes} 分</Text>
          <Text style={styles.exerciseCalories}>{exercise.caloriesBurned} kcal 消費</Text>
        </View>
        {exercise.note ? <Text style={styles.cardNote}>{exercise.note}</Text> : null}
      </View>
    </View>
  );
}

export default function DayDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { date } = route.params;
  const { meals, exercises } = useAppContext();

  const dayMeals = getMealsByDate(meals, date);
  const dayExercises = getExercisesByDate(exercises, date);
  const totalCalories = sumCalories(dayMeals);
  const totalBurned = sumBurned(dayExercises);
  const totalDuration = sumDuration(dayExercises);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.dateLabel}>{parseDateLabel(date)}</Text>

      {/* Summary */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalCalories}</Text>
          <Text style={styles.summaryLabel}>{t('calendar.intakeKcal')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#FF7043' }]}>{totalBurned}</Text>
          <Text style={styles.summaryLabel}>{t('calendar.burnedKcal')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{dayMeals.length}</Text>
          <Text style={styles.summaryLabel}>{t('calendar.mealCount')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{dayExercises.length}</Text>
          <Text style={styles.summaryLabel}>{t('calendar.exerciseCount')}</Text>
        </View>
      </View>

      {totalDuration > 0 && (
        <Text style={styles.durationNote}>合計運動時間: {totalDuration} 分</Text>
      )}

      {/* Meals */}
      <Text style={styles.sectionTitle}>{t('calendar.mealRecords')}（{dayMeals.length}）</Text>
      {dayMeals.length > 0 ? (
        dayMeals.map((m) => <MealDetailCard key={m.id} meal={m} />)
      ) : (
        <Text style={styles.noData}>{t('calendar.noMeal')}</Text>
      )}

      {/* Exercises */}
      <Text style={styles.sectionTitle}>{t('calendar.exerciseRecords')}（{dayExercises.length}）</Text>
      {dayExercises.length > 0 ? (
        dayExercises.map((e) => <ExerciseDetailCard key={e.id} exercise={e} />)
      ) : (
        <Text style={styles.noData}>{t('calendar.noExercise')}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16, paddingBottom: 40 },
  dateLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  summaryGrid: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#F0F0F0' },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  durationNote: { fontSize: 12, color: '#888', marginBottom: 16, marginLeft: 4 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  noData: { fontSize: 13, color: '#BDBDBD', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mealPhoto: { width: '100%', height: 160, backgroundColor: '#F0F0F0' },
  cardBody: { padding: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  cardTime: { fontSize: 12, color: '#888' },
  catBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  catBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  cardName: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  cardNote: { fontSize: 12, color: '#BDBDBD', marginTop: 4 },
  cardCalories: { fontSize: 14, fontWeight: '600', color: '#4CAF50', marginTop: 6 },
  gymBadge: { backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  gymBadgeText: { fontSize: 11, color: '#FF7043', fontWeight: '600' },
  exerciseMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  exerciseDetail: { fontSize: 13, color: '#888' },
  exerciseCalories: { fontSize: 13, fontWeight: '600', color: '#FF7043' },
});
