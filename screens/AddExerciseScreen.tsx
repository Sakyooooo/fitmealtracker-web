import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import { todayString } from '../utils/stats';
import { ExerciseStackParamList } from '../navigation/types';
import { estimateExerciseCalories } from '../services/exercise';

type Props = {
  navigation: NativeStackNavigationProp<ExerciseStackParamList, 'AddExercise'>;
};

const FAV_KEY = '@fav_exercises';

const DEFAULT_PRESETS = [
  'ランニング', 'ウォーキング', '筋トレ', '水泳',
  'サイクリング', 'ヨガ', 'その他',
];

export default function AddExerciseScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { addExercise } = useAppContext();
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [burned, setBurned] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  // お気に入りをロード
  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY).then((val) => {
      if (val) setFavorites(JSON.parse(val) as string[]);
    });
  }, []);

  // 種目名・時間が変わるたびにカロリー推定を自動反映
  useEffect(() => {
    const dur = parseInt(duration, 10);
    if (name.trim() && !isNaN(dur) && dur > 0) {
      setBurned(String(estimateExerciseCalories(name.trim(), dur)));
    }
  }, [name, duration]);

  async function toggleFavorite(preset: string) {
    const next = favorites.includes(preset)
      ? favorites.filter((f) => f !== preset)
      : [...favorites, preset];
    setFavorites(next);
    await AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
  }

  function selectPreset(preset: string) {
    if (preset === 'その他') {
      setName('');
    } else {
      setName(preset);
    }
  }

  const handleSave = () => {
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
    addExercise({
      name: name.trim(),
      durationMinutes: dur,
      caloriesBurned: cal,
      date: todayString(),
      note: note.trim(),
      type: 'normal',
    });
    navigation.goBack();
  };

  // お気に入りを先頭に、残りをデフォルト順で表示（重複除去）
  const orderedPresets = [
    ...favorites.filter((f) => DEFAULT_PRESETS.includes(f)),
    ...DEFAULT_PRESETS.filter((p) => !favorites.includes(p)),
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>{t('exercise.name')}</Text>

        {/* プリセット選択 */}
        <View style={styles.presetGrid}>
          {orderedPresets.map((preset) => {
            const isFav = favorites.includes(preset);
            const isSelected = name === preset || (preset === 'その他' && !DEFAULT_PRESETS.slice(0, -1).includes(name) && name !== '');
            return (
              <View key={preset} style={styles.presetItem}>
                <TouchableOpacity
                  style={[styles.presetBtn, isSelected && styles.presetBtnSelected]}
                  onPress={() => selectPreset(preset)}
                >
                  <Text style={[styles.presetBtnText, isSelected && styles.presetBtnTextSelected]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.favBtn}
                  onPress={() => toggleFavorite(preset)}
                >
                  <Text style={[styles.favStar, isFav && styles.favStarActive]}>★</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('exercise.namePlaceholder')}
          returnKeyType="next"
          maxLength={40}
        />

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
        <TextInput
          style={styles.input}
          value={burned}
          onChangeText={setBurned}
          placeholder={t('exercise.burnedPlaceholder')}
          keyboardType="numeric"
          returnKeyType="next"
        />
        <Text style={styles.hint}>{t('exercise.burnedHint')}</Text>

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
  label: {
    fontSize: 14, fontWeight: '600', color: '#555',
    marginBottom: 6, marginTop: 20,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  presetBtnSelected: {
    backgroundColor: '#FF7043',
    borderColor: '#FF7043',
  },
  presetBtnText: { fontSize: 13, color: '#555', fontWeight: '500' },
  presetBtnTextSelected: { color: '#fff', fontWeight: '700' },
  favBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  favStar: { fontSize: 14, color: '#E0E0E0' },
  favStarActive: { color: '#FDD835' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  hint: { fontSize: 12, color: '#BDBDBD', marginTop: 4, marginLeft: 2 },
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
