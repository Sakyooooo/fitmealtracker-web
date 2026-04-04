import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import { ExerciseStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<ExerciseStackParamList, 'ExerciseDetail'>;
  route: RouteProp<ExerciseStackParamList, 'ExerciseDetail'>;
};

export default function ExerciseDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { exercises, deleteExercise } = useAppContext();
  const { exerciseId } = route.params;
  const exercise = exercises.find((e) => e.id === exerciseId);

  if (!exercise) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#BDBDBD" />
        <Text style={styles.notFoundText}>記録が見つかりませんでした</Text>
      </View>
    );
  }

  function handleDelete() {
    Alert.alert(t('common.deleteConfirm'), t('exercise.deleteConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteExercise(exercise!.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.name}>{exercise.name}</Text>
          {exercise.type === 'gymSession' && (
            <View style={styles.gymBadge}>
              <Text style={styles.gymBadgeText}>ジム</Text>
            </View>
          )}
        </View>

        <Text style={styles.dateText}>{exercise.date}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{exercise.durationMinutes}</Text>
            <Text style={styles.statLabel}>{t('common.min')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FF7043' }]}>{exercise.caloriesBurned}</Text>
            <Text style={styles.statLabel}>kcal 消費</Text>
          </View>
        </View>

        {exercise.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>{t('exercise.detailNote')}</Text>
            <Text style={styles.noteText}>{exercise.note}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => navigation.navigate('EditExercise', { exerciseId: exercise.id })}
        >
          <Ionicons name="pencil-outline" size={18} color="#FF7043" />
          <Text style={[styles.actionBtnText, { color: '#FF7043' }]}>{t('common.edit')}</Text>
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
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  notFoundText: { fontSize: 15, color: '#888' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  name: { fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1 },
  gymBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gymBadgeText: { fontSize: 12, color: '#FF7043', fontWeight: '700' },
  dateText: { fontSize: 13, color: '#888', marginBottom: 20 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: '#E0E0E0' },
  statValue: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 2 },
  noteBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  noteLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  noteText: { fontSize: 14, color: '#555' },
  actionRow: { flexDirection: 'row', gap: 12 },
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
  editBtn: { borderColor: '#FF7043', backgroundColor: '#FFF3E0' },
  deleteBtn: { borderColor: '#F44336', backgroundColor: '#FFEBEE' },
  actionBtnText: { fontSize: 15, fontWeight: '700' },
});
