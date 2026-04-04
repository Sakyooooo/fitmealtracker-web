import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import { MealStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<MealStackParamList, 'MealDetail'>;
  route: RouteProp<MealStackParamList, 'MealDetail'>;
};

function PfcBar({ label, value, color, unit }: { label: string; value: number; color: string; unit: string }) {
  // 最大100g を100%として幅を計算（表示のみ）
  const pct = Math.min(Math.round((value / 100) * 100), 100);
  return (
    <View style={pfcStyles.row}>
      <Text style={pfcStyles.label}>{label}</Text>
      <View style={pfcStyles.barBg}>
        <View style={[pfcStyles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={pfcStyles.value}>{value}{unit}</Text>
    </View>
  );
}

const pfcStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { fontSize: 12, color: '#555', width: 60 },
  barBg: { flex: 1, height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  value: { fontSize: 12, color: '#333', fontWeight: '600', width: 36, textAlign: 'right' },
});

const CATEGORY_COLORS: Record<string, string> = {
  朝食: '#FF8F00',
  昼食: '#1E88E5',
  夕食: '#6D4C41',
  間食: '#8E24AA',
};

export default function MealDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { meals, deleteMeal } = useAppContext();
  const { mealId } = route.params;
  const meal = meals.find((m) => m.id === mealId);

  if (!meal) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#BDBDBD" />
        <Text style={styles.notFoundText}>記録が見つかりませんでした</Text>
      </View>
    );
  }

  function handleDelete() {
    Alert.alert(t('common.deleteConfirm'), t('meal.deleteConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteMeal(meal!.id);
          navigation.goBack();
        },
      },
    ]);
  }

  const badgeColor = CATEGORY_COLORS[meal.category] ?? '#888';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {meal.photoUri ? (
        <Image source={{ uri: meal.photoUri }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.noPhoto}>
          <Ionicons name="image-outline" size={40} color="#BDBDBD" />
          <Text style={styles.noPhotoText}>写真なし</Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={[styles.catBadge, { backgroundColor: badgeColor }]}>
            <Text style={styles.catText}>{meal.category}</Text>
          </View>
          <Text style={styles.dateTime}>{meal.date}　{meal.time}</Text>
        </View>

        <Text style={styles.name}>{meal.name}</Text>
        <Text style={styles.calories}>{meal.calories} kcal</Text>

        {(meal.protein != null || meal.fat != null || meal.carbs != null) && (
          <View style={styles.pfcCard}>
            <Text style={styles.pfcTitle}>栄養素 PFC</Text>
            {meal.protein != null && (
              <PfcBar label={t('meal.proteinShort')} value={meal.protein} color="#1E88E5" unit="g" />
            )}
            {meal.fat != null && (
              <PfcBar label={t('meal.fatShort')} value={meal.fat} color="#FDD835" unit="g" />
            )}
            {meal.carbs != null && (
              <PfcBar label={t('meal.carbsShort')} value={meal.carbs} color="#4CAF50" unit="g" />
            )}
          </View>
        )}

        {meal.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>{t('meal.detailNote')}</Text>
            <Text style={styles.noteText}>{meal.note}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => navigation.navigate('EditMeal', { mealId: meal.id })}
        >
          <Ionicons name="pencil-outline" size={18} color="#4CAF50" />
          <Text style={[styles.actionBtnText, { color: '#4CAF50' }]}>{t('common.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color="#F44336" />
          <Text style={[styles.actionBtnText, { color: '#F44336' }]}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  notFoundText: { fontSize: 15, color: '#888' },
  photo: { width: '100%', height: 240, backgroundColor: '#F0F0F0' },
  noPhoto: {
    height: 120,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noPhotoText: { fontSize: 13, color: '#BDBDBD' },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  catText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  dateTime: { fontSize: 13, color: '#888' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  calories: { fontSize: 32, fontWeight: 'bold', color: '#4CAF50', marginBottom: 12 },
  pfcCard: {
    backgroundColor: '#F9FBE7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EE9C',
  },
  pfcTitle: { fontSize: 12, fontWeight: '700', color: '#558B2F', marginBottom: 10 },
  noteBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  noteLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  noteText: { fontSize: 14, color: '#555' },
  actionRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  editBtn: { borderColor: '#4CAF50', backgroundColor: '#E8F5E9' },
  deleteBtn: { borderColor: '#F44336', backgroundColor: '#FFEBEE' },
  actionBtnText: { fontSize: 15, fontWeight: '700' },
});
