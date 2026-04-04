import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import { getExercisesByDate, sumBurned, sumDuration, todayString } from '../utils/stats';
import { ExerciseStackParamList } from '../navigation/types';
import { ExerciseEntry } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<ExerciseStackParamList, 'ExerciseList'>;
};

// ─── Gym Session Card ─────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function GymSessionCard() {
  const { t } = useTranslation();
  const { activeGymSession, startGymSession, endGymSession, cancelGymSession } = useAppContext();
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [burnedInput, setBurnedInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    if (!activeGymSession) {
      setElapsedSec(0);
      return;
    }
    const started = new Date(activeGymSession.startedAt).getTime();
    const update = () => setElapsedSec(Math.floor((Date.now() - started) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeGymSession]);

  function handleConfirmEnd() {
    const cal = parseInt(burnedInput, 10) || 0;
    endGymSession(cal, noteInput.trim());
    setShowModal(false);
    setBurnedInput('');
    setNoteInput('');
  }

  function handleCancel() {
    Alert.alert(t('exercise.gymCancelConfirm'), t('exercise.gymCancelMsg'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('exercise.gymCancelBtn'), style: 'destructive', onPress: cancelGymSession },
    ]);
  }

  return (
    <>
      <View style={gymStyles.card}>
        <View style={gymStyles.header}>
          <Text style={gymStyles.title}>{t('exercise.gym')}</Text>
          {activeGymSession && (
            <View style={gymStyles.activeBadge}>
              <Text style={gymStyles.activeBadgeText}>● {t('exercise.gymActive')}</Text>
            </View>
          )}
        </View>

        {activeGymSession ? (
          <>
            <Text style={gymStyles.timer}>{formatElapsed(elapsedSec)}</Text>
            <Text style={gymStyles.startTime}>{t('exercise.gymStartedAt')}: {formatTime(activeGymSession.startedAt)}</Text>
            <View style={gymStyles.actionRow}>
              <TouchableOpacity style={gymStyles.endBtn} onPress={() => setShowModal(true)}>
                <Text style={gymStyles.endBtnText}>{t('exercise.gymEnd')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={gymStyles.cancelBtn} onPress={handleCancel}>
                <Ionicons name="close" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={gymStyles.startBtn} onPress={startGymSession}>
            <Ionicons name="fitness-outline" size={20} color="#FF7043" />
            <Text style={gymStyles.startBtnText}>{t('exercise.gymStart')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* End Gym Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={gymStyles.modalOverlay}>
            <View style={gymStyles.modalContent}>
              <Text style={gymStyles.modalTitle}>{t('exercise.gymEnd')}</Text>
              <Text style={gymStyles.modalElapsed}>{formatElapsed(elapsedSec)}</Text>

              <Text style={gymStyles.modalLabel}>{t('exercise.gymBurned')}</Text>
              <TextInput
                style={gymStyles.modalInput}
                value={burnedInput}
                onChangeText={setBurnedInput}
                keyboardType="numeric"
                placeholder={t('exercise.gymBurnedPlaceholder')}
                returnKeyType="next"
              />

              <Text style={gymStyles.modalLabel}>{t('exercise.gymNote')}</Text>
              <TextInput
                style={gymStyles.modalInput}
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder={t('exercise.gymNotePlaceholder')}
                returnKeyType="done"
              />

              <View style={gymStyles.modalButtons}>
                <TouchableOpacity
                  style={gymStyles.modalCancelBtn}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={gymStyles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={gymStyles.modalConfirmBtn} onPress={handleConfirmEnd}>
                  <Text style={gymStyles.modalConfirmText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

type ExerciseCardProps = {
  item: ExerciseEntry;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function ExerciseCard({ item, onPress, onEdit, onDelete }: ExerciseCardProps) {
  const { t } = useTranslation();
  function handleLongPress() {
    Alert.alert(item.name, t('common.selectAction'), [
      { text: t('common.edit'), onPress: onEdit },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('common.deleteConfirm'), t('exercise.deleteConfirmMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: onDelete },
          ]),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity
      style={styles.exerciseCard}
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      activeOpacity={0.85}
    >
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{item.name}</Text>
        {item.type === 'gymSession' && (
          <View style={styles.gymBadge}>
            <Text style={styles.gymBadgeText}>ジム</Text>
          </View>
        )}
      </View>
      <View style={styles.exerciseMeta}>
        <Text style={styles.exerciseDetail}>{item.durationMinutes} {t('common.min')}</Text>
        <Text style={styles.exerciseCalories}>{item.caloriesBurned} {t('common.kcal')}</Text>
      </View>
      {item.note ? <Text style={styles.exerciseNote}>{item.note}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExerciseScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { exercises, deleteExercise, settings } = useAppContext();
  const today = todayString();
  const [filterAll, setFilterAll] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);

  const target = settings.targetBurnedCalories ?? 300;

  const filtered = filterAll ? exercises : getExercisesByDate(exercises, today);
  const sorted = [...filtered].sort((a, b) =>
    sortAsc
      ? a.date.localeCompare(b.date)
      : b.date.localeCompare(a.date),
  );

  const todayBurned = sumBurned(getExercisesByDate(exercises, today));
  const todayDuration = sumDuration(getExercisesByDate(exercises, today));
  const achieveRate = Math.min(Math.round((todayBurned / target) * 100), 100);

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExerciseCard
            item={item}
            onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: item.id })}
            onEdit={() => navigation.navigate('EditExercise', { exerciseId: item.id })}
            onDelete={() => deleteExercise(item.id)}
          />
        )}
        ListHeaderComponent={
          <>
            <GymSessionCard />
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{todayDuration}</Text>
                <Text style={styles.statLabel}>{t('common.min')}</Text>
              </View>
              <View style={[styles.statCard, styles.statCardHighlight]}>
                <Text style={[styles.statValue, styles.statValueWhite]}>{todayBurned}</Text>
                <Text style={[styles.statLabel, styles.statLabelWhite]}>{t('common.kcal')}</Text>
              </View>
            </View>

            <View style={styles.achieveCard}>
              <View style={styles.achieveRow}>
                <Text style={styles.achieveLabel}>{t('exercise.todayBurnedRate')}</Text>
                <Text style={styles.achieveValue}>{achieveRate}%</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${achieveRate}%` as any }]} />
              </View>
              <Text style={styles.achieveGoal}>{t('meal.target')}: {target} kcal</Text>
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
                  color="#FF7043"
                />
                <Text style={styles.sortText}>{sortAsc ? t('meal.oldest') : t('meal.newest')}</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={48} color="#FFCCBC" />
            <Text style={styles.emptyText}>{t('exercise.noRecord')}</Text>
            <Text style={styles.emptySubText}>{t('exercise.addExercise')}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddExercise')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const gymStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: '#333' },
  activeBadge: { backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { fontSize: 12, color: '#FF7043', fontWeight: '600' },
  timer: { fontSize: 36, fontWeight: 'bold', color: '#FF7043', textAlign: 'center', marginBottom: 4 },
  startTime: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  endBtn: {
    flex: 1,
    backgroundColor: '#FF7043',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  endBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#FF7043',
    borderRadius: 10,
    padding: 14,
  },
  startBtnText: { color: '#FF7043', fontWeight: 'bold', fontSize: 15 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  modalElapsed: { fontSize: 14, color: '#888', marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 14 },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#666' },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: '#FF7043',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  statsRow: { flexDirection: 'row', margin: 16, gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardHighlight: { backgroundColor: '#FF7043' },
  statValue: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  statValueWhite: { color: '#fff' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 2 },
  statLabelWhite: { color: '#FFE0D4' },
  achieveCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  achieveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  achieveLabel: { fontSize: 13, color: '#555' },
  achieveValue: { fontSize: 15, fontWeight: 'bold', color: '#FF7043' },
  progressBg: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF7043',
    borderRadius: 3,
  },
  achieveGoal: { fontSize: 12, color: '#BDBDBD' },
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
    borderColor: '#FF7043',
  },
  toggleBtnActive: { backgroundColor: '#FF7043' },
  toggleText: { fontSize: 13, color: '#FF7043', fontWeight: '600' },
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
    borderColor: '#FF7043',
  },
  sortText: { fontSize: 13, color: '#FF7043', fontWeight: '600' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 88 },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  gymBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gymBadgeText: { fontSize: 11, color: '#FF7043', fontWeight: '600' },
  exerciseMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  exerciseDetail: { fontSize: 13, color: '#888' },
  exerciseCalories: { fontSize: 13, fontWeight: '600', color: '#FF7043' },
  exerciseNote: { fontSize: 12, color: '#BDBDBD', marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 32, gap: 8 },
  emptyText: { fontSize: 15, color: '#888' },
  emptySubText: { fontSize: 13, color: '#BDBDBD' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF7043',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});
