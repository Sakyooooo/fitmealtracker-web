import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import { getMealsByDate, sumCalories, todayString } from '../utils/stats';
import { MealStackParamList } from '../navigation/types';
import { MealEntry } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<MealStackParamList, 'MealList'>;
};

const CATEGORY_COLORS: Record<string, string> = {
  朝食: '#FF8F00',
  昼食: '#1E88E5',
  夕食: '#6D4C41',
  間食: '#8E24AA',
};

type MealCardProps = {
  item: MealEntry;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function MealCard({ item, onPress, onEdit, onDelete }: MealCardProps) {
  const { t } = useTranslation();
  function handleLongPress() {
    Alert.alert(item.name, t('common.selectAction'), [
      { text: t('common.edit'), onPress: onEdit },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('common.deleteConfirm'), t('meal.deleteConfirmMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: onDelete },
          ]),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity
      style={styles.mealCard}
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      activeOpacity={0.85}
    >
      {item.photoUri && (
        <Image source={{ uri: item.photoUri }} style={styles.thumbnail} />
      )}
      <View style={styles.mealLeft}>
        <View style={styles.mealTopRow}>
          <Text style={styles.mealTime}>{item.time}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[item.category] ?? '#888' }]}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>
        <Text style={styles.mealName}>{item.name}</Text>
        {item.note ? <Text style={styles.mealNote}>{item.note}</Text> : null}
      </View>
      <Text style={styles.mealCalories}>{item.calories} kcal</Text>
    </TouchableOpacity>
  );
}

export default function MealScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { meals, deleteMeal, settings } = useAppContext();
  const today = todayString();
  const [filterAll, setFilterAll] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);

  const target = settings.targetIntakeCalories ?? 2000;

  const filtered = filterAll ? meals : getMealsByDate(meals, today);
  const sorted = [...filtered].sort((a, b) =>
    sortAsc
      ? `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
      : `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
  );

  const todayTotal = sumCalories(getMealsByDate(meals, today));
  const achieveRate = Math.min(Math.round((todayTotal / target) * 100), 100);

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MealCard
            item={item}
            onPress={() => navigation.navigate('MealDetail', { mealId: item.id })}
            onEdit={() => navigation.navigate('EditMeal', { mealId: item.id })}
            onDelete={() => deleteMeal(item.id)}
          />
        )}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('meal.todayIntake')}</Text>
              <Text style={styles.summaryValue}>{todayTotal} kcal</Text>
              <Text style={styles.summaryGoal}>{t('meal.target')}: {target} kcal</Text>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${achieveRate}%` as any }]} />
              </View>
              <Text style={styles.achieveText}>{achieveRate}% {t('meal.achieved')}</Text>
            </View>

            <View style={styles.controlRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !filterAll && styles.toggleBtnActive]}
                onPress={() => setFilterAll(false)}
              >
                <Text style={[styles.toggleText, !filterAll && styles.toggleTextActive]}>{t('meal.today')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, filterAll && styles.toggleBtnActive]}
                onPress={() => setFilterAll(true)}
              >
                <Text style={[styles.toggleText, filterAll && styles.toggleTextActive]}>{t('meal.all')}</Text>
              </TouchableOpacity>
              <View style={styles.controlSpacer} />
              <TouchableOpacity
                style={styles.sortBtn}
                onPress={() => setSortAsc((v) => !v)}
              >
                <Ionicons
                  name={sortAsc ? 'arrow-up-outline' : 'arrow-down-outline'}
                  size={14}
                  color="#4CAF50"
                />
                <Text style={styles.sortText}>{sortAsc ? t('meal.oldest') : t('meal.newest')}</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={48} color="#C8E6C9" />
            <Text style={styles.emptyText}>{t('meal.noRecord')}</Text>
            <Text style={styles.emptySubText}>{t('meal.addMeal')}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddMeal')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  summaryCard: {
    backgroundColor: '#4CAF50',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  summaryLabel: { color: '#E8F5E9', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: 4 },
  summaryGoal: { color: '#E8F5E9', fontSize: 13, marginBottom: 10 },
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  achieveText: { color: '#E8F5E9', fontSize: 12, marginTop: 6 },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 6,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  toggleBtnActive: { backgroundColor: '#4CAF50' },
  toggleText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  controlSpacer: { flex: 1 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  sortText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 88 },
  mealCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F0F0F0',
  },
  mealLeft: { flex: 1 },
  mealTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  mealTime: { fontSize: 12, color: '#888' },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  mealName: { fontSize: 15, color: '#333' },
  mealNote: { fontSize: 12, color: '#BDBDBD', marginTop: 2 },
  mealCalories: { fontSize: 15, fontWeight: '600', color: '#4CAF50', marginLeft: 8 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyText: { fontSize: 15, color: '#888' },
  emptySubText: { fontSize: 13, color: '#BDBDBD' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});
