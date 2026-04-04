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
  Image,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import { MealCategory, MealAnalysisResult } from '../types';
import { MealStackParamList } from '../navigation/types';
import { pickImageFromLibrary, takePhotoWithCamera, analyzeMealPhoto } from '../services/photo';
import { DatePickerField, TimePickerField } from '../components/PickerFields';

type Props = {
  navigation: NativeStackNavigationProp<MealStackParamList, 'EditMeal'>;
  route: RouteProp<MealStackParamList, 'EditMeal'>;
};

const CATEGORIES: MealCategory[] = ['朝食', '昼食', '夕食', '間食'];

export default function EditMealScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { meals, updateMeal } = useAppContext();
  const { mealId } = route.params;
  const original = meals.find((m) => m.id === mealId);

  if (!original) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>記録が見つかりませんでした</Text>
      </View>
    );
  }

  const [name, setName] = useState(original.name);
  const [calories, setCalories] = useState(String(original.calories));
  const [time, setTime] = useState(original.time);
  const [date, setDate] = useState(original.date);
  const [category, setCategory] = useState<MealCategory>(original.category);
  const [note, setNote] = useState(original.note ?? '');
  const [photoUri, setPhotoUri] = useState<string | undefined>(original.photoUri);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<MealAnalysisResult | null>(null);
  const [protein, setProtein] = useState(original.protein != null ? String(original.protein) : '');
  const [fat, setFat] = useState(original.fat != null ? String(original.fat) : '');
  const [carbs, setCarbs] = useState(original.carbs != null ? String(original.carbs) : '');
  const [showPfc, setShowPfc] = useState(
    original.protein != null || original.fat != null || original.carbs != null,
  );

  async function pickFromLibrary() {
    setPhotoLoading(true);
    try {
      const uri = await pickImageFromLibrary();
      if (uri) setPhotoUri(uri);
    } catch {
      Alert.alert('エラー', '画像の保存に失敗しました');
    } finally {
      setPhotoLoading(false);
    }
  }

  async function takePhoto() {
    setPhotoLoading(true);
    try {
      const uri = await takePhotoWithCamera();
      if (uri) setPhotoUri(uri);
    } catch {
      Alert.alert('エラー', '画像の保存に失敗しました');
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!photoUri) return;
    setAnalyzeLoading(true);
    setAnalyzeResult(null);
    try {
      const result = await analyzeMealPhoto(photoUri);
      setAnalyzeResult(result);
      if (result.estimatedCalories !== null) setCalories(String(result.estimatedCalories));
      if (result.dishName && !name.trim()) setName(result.dishName);
      if (result.protein !== null) { setProtein(String(result.protein)); setShowPfc(true); }
      if (result.fat !== null) { setFat(String(result.fat)); setShowPfc(true); }
      if (result.carbs !== null) { setCarbs(String(result.carbs)); setShowPfc(true); }
    } catch {
      Alert.alert('エラー', '解析に失敗しました');
    } finally {
      setAnalyzeLoading(false);
    }
  }

  function handleSave() {
    if (!original) return;
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('meal.errorName'));
      return;
    }
    const cal = parseInt(calories, 10);
    if (isNaN(cal) || cal < 0) {
      Alert.alert(t('common.error'), t('meal.errorCalories'));
      return;
    }
    const proteinVal = parseFloat(protein);
    const fatVal = parseFloat(fat);
    const carbsVal = parseFloat(carbs);
    updateMeal({
      id: original.id,
      name: name.trim(),
      calories: cal,
      time,
      date,
      category,
      note: note.trim() || undefined,
      photoUri,
      protein: !isNaN(proteinVal) && proteinVal >= 0 ? proteinVal : undefined,
      fat: !isNaN(fatVal) && fatVal >= 0 ? fatVal : undefined,
      carbs: !isNaN(carbsVal) && carbsVal >= 0 ? carbsVal : undefined,
    });
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* 写真セクション */}
        <Text style={styles.label}>{t('meal.photo')}</Text>
        <View style={styles.photoSection}>
          {photoLoading ? (
            <View style={styles.photoPlaceholder}>
              <ActivityIndicator color="#4CAF50" />
            </View>
          ) : photoUri ? (
            <>
              <TouchableOpacity onPress={pickFromLibrary}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <Text style={styles.photoHint}>{t('meal.tapToChange')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.analyzeBtn}
                onPress={handleAnalyze}
                disabled={analyzeLoading}
              >
                {analyzeLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={18} color="#fff" />
                    <Text style={styles.analyzeBtnText}>{t('meal.analyzePhoto')}</Text>
                  </>
                )}
              </TouchableOpacity>
              {analyzeResult && (
                <View style={styles.resultBanner}>
                  <View style={styles.resultRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.resultTitle}>{t('meal.analysisResult')}</Text>
                  </View>
                  {analyzeResult.confidence !== null && (
                    <Text style={styles.resultConfidence}>
                      信頼度: {Math.round(analyzeResult.confidence * 100)}%
                    </Text>
                  )}
                  {analyzeResult.notes && (
                    <Text style={styles.resultNotes}>{analyzeResult.notes}</Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickFromLibrary}>
                <Ionicons name="images-outline" size={22} color="#4CAF50" />
                <Text style={styles.photoBtnText}>ライブラリ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={22} color="#4CAF50" />
                <Text style={styles.photoBtnText}>カメラ</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.label}>{t('meal.name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('meal.namePlaceholder')}
          returnKeyType="next"
          maxLength={60}
        />

        <Text style={styles.label}>{t('meal.calories')}</Text>
        <TextInput
          style={styles.input}
          value={calories}
          onChangeText={setCalories}
          placeholder={t('meal.caloriesPlaceholder')}
          keyboardType="numeric"
          returnKeyType="next"
        />

        <Text style={styles.label}>{t('meal.time')}</Text>
        <TimePickerField value={time} onChange={setTime} />

        <Text style={styles.label}>{t('exercise.detailDate')}</Text>
        <DatePickerField value={date} onChange={setDate} />

        <Text style={styles.label}>{t('meal.category')}</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryBtn, category === cat && styles.categoryBtnActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* PFC セクション（折りたたみ式） */}
        <TouchableOpacity style={styles.pfcToggle} onPress={() => setShowPfc((v) => !v)}>
          <Text style={styles.pfcToggleText}>{t('meal.pfc')}</Text>
          <Ionicons name={showPfc ? 'chevron-up' : 'chevron-down'} size={16} color="#4CAF50" />
        </TouchableOpacity>
        {showPfc && (
          <View style={styles.pfcRow}>
            <View style={styles.pfcField}>
              <Text style={styles.pfcLabel}>🟦 タンパク質 (g)</Text>
              <TextInput
                style={styles.pfcInput}
                value={protein}
                onChangeText={setProtein}
                placeholder="0"
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <View style={styles.pfcField}>
              <Text style={styles.pfcLabel}>🟨 脂質 (g)</Text>
              <TextInput
                style={styles.pfcInput}
                value={fat}
                onChangeText={setFat}
                placeholder="0"
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <View style={styles.pfcField}>
              <Text style={styles.pfcLabel}>🟩 炭水化物 (g)</Text>
              <TextInput
                style={styles.pfcInput}
                value={carbs}
                onChangeText={setCarbs}
                placeholder="0"
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
          </View>
        )}

        <Text style={styles.label}>{t('common.memo')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder={t('meal.memoPlaceholder')}
          multiline
          numberOfLines={2}
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
  textArea: { height: 72, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  categoryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  categoryBtnActive: { backgroundColor: '#4CAF50' },
  categoryText: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  categoryTextActive: { color: '#fff' },
  photoSection: { marginTop: 4 },
  photoPlaceholder: {
    height: 120,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  photoHint: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 4 },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  photoBtnText: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  analyzeBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  resultBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    gap: 4,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultTitle: { fontSize: 12, color: '#388E3C', fontWeight: '600', flex: 1 },
  resultConfidence: { fontSize: 12, color: '#555', marginLeft: 22 },
  resultNotes: { fontSize: 12, color: '#666', marginLeft: 22, lineHeight: 17 },
  pfcToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  pfcToggleText: { fontSize: 14, fontWeight: '600', color: '#4CAF50' },
  pfcRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pfcField: { flex: 1 },
  pfcLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  pfcInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
