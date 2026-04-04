import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import { ExerciseStackParamList } from '../navigation/types';
import { estimateExerciseCalories } from '../services/exercise';
import { ActivitySuggest } from '../components/ActivitySuggest';
import { DatePickerField } from '../components/PickerFields';

type Props = {
  navigation: NativeStackNavigationProp<ExerciseStackParamList, 'EditExercise'>;
  route: RouteProp<ExerciseStackParamList, 'EditExercise'>;
};

export default function EditExerciseScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { exercises, updateExercise } = useAppContext();
  const { exerciseId } = route.params;
  const original = exercises.find((e) => e.id === exerciseId);

  if (!original) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>記録が見つかりませんでした</Text>
      </View>
    );
  }

  const [name, setName] = useState(original.name);
  const [duration, setDuration] = useState(String(original.durationMinutes));
  const [burned, setBurned] = useState(String(original.caloriesBurned));
  const [date, setDate] = useState(original.date);
  const [note, setNote] = useState(original.note);

  function handleEstimate() {
    const dur = parseInt(duration, 10);
    if (!name.trim() || isNaN(dur) || dur <= 0) {
      Alert.alert('推定エラー', '種目名と時間を正しく入力してください');
      return;
    }
    const estimated = estimateExerciseCalories(name.trim(), dur);
    setBurned(String(estimated));
  }

  function handleSave() {
    if (!original) return;
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('exercise.errorName'));
      return;
    }
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur <= 0) {
      Alert.alert(t('common.error'), t('exercise.errorDuration'));
      return;
    }
    const cal = parseInt(burned, 10);
    if (isNaN(cal) || cal < 0) {
      Alert.alert(t('common.error'), t('exercise.errorBurned'));
      return;
    }
    updateExercise({
      id: original.id,
      name: name.trim(),
      durationMinutes: dur,
      caloriesBurned: cal,
      date,
      note: note.trim(),
      type: original.type,
    });
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>{t('exercise.name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例: ジョギング"
          returnKeyType="next"
          maxLength={40}
        />

        <ActivitySuggest input={name} onSelect={setName} />

        <Text style={styles.label}>{t('exercise.duration')}</Text>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          placeholder={t('exercise.durationPlaceholder')}
          keyboardType="numeric"
          returnKeyType="next"
        />

        <Text style={styles.label}>{t('exercise.burned')}</Text>
        <View style={styles.burnedRow}>
          <TextInput
            style={[styles.input, styles.burnedInput]}
            value={burned}
            onChangeText={setBurned}
            placeholder={t('exercise.burnedPlaceholder')}
            keyboardType="numeric"
            returnKeyType="next"
          />
          <TouchableOpacity style={styles.estimateBtn} onPress={handleEstimate}>
            <Text style={styles.estimateBtnText}>推定</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>日付</Text>
        <DatePickerField value={date} onChange={setDate} />

        <Text style={styles.label}>{t('common.memo')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder={t('exercise.memoPlaceholder')}
          multiline
          numberOfLines={3}
          returnKeyType="done"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{t('common.save')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 20, paddingBottom: 48 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 15, color: '#888' },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  burnedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  burnedInput: { flex: 1 },
  estimateBtn: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FF7043',
  },
  estimateBtnText: { color: '#FF7043', fontWeight: '700', fontSize: 14 },
  textArea: { height: 90, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: '#FF7043',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 36,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
