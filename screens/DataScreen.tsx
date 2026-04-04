import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/AppContext';
import {
  getRecentDayStats, DayStat, todayString, calcStreak,
  sumProtein, sumFat, sumCarbs, getMealsByDate, getExercisesByDate,
} from '../utils/stats';
import { setLanguage, AppLanguage } from '../i18n';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64;

// PFCデフォルト目標値
const DEFAULT_TARGET_PROTEIN = 60;
const DEFAULT_TARGET_FAT = 60;
const DEFAULT_TARGET_CARBS = 260;

type StatRowProps = { label: string; value: string; sub?: string };

function StatRow({ label, value, sub }: StatRowProps) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRight}>
        <Text style={styles.statValue}>{value}</Text>
        {sub && <Text style={styles.statSub}>{sub}</Text>}
      </View>
    </View>
  );
}

type PfcProgressProps = {
  label: string;
  actual: number;
  target: number;
  color: string;
  unit: string;
};

function PfcProgress({ label, actual, target, color, unit }: PfcProgressProps) {
  const pct = Math.min(actual / target, 1);
  const achieved = actual >= target;
  const barColor = achieved ? '#4CAF50' : '#FF9800';
  return (
    <View style={styles.pfcProgressRow}>
      <View style={styles.pfcProgressHeader}>
        <Text style={styles.pfcProgressLabel}>{label}</Text>
        <Text style={[styles.pfcProgressValue, { color }]}>
          {actual}{unit} / {target}{unit}
        </Text>
      </View>
      <View style={styles.pfcBarBg}>
        <View style={[styles.pfcBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.pfcPct}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

const BASE_CHART_CONFIG = {
  backgroundColor: '#fff',
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(200, 200, 200, ${opacity})`,
  labelColor: () => '#888',
  style: { borderRadius: 12 },
  propsForDots: { r: '3', strokeWidth: '1' },
  propsForBackgroundLines: { stroke: '#F5F5F5', strokeDasharray: '' },
};

export default function DataScreen() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as AppLanguage;
  const { meals, exercises, weights, settings, addWeight, updateSettings } = useAppContext();
  const weekStats: DayStat[] = getRecentDayStats(meals, exercises, 7);
  const streak = calcStreak(meals, exercises);

  // ─── カロリー集計 ─────────────────────────────────────────────────────────
  const totalCalories = weekStats.reduce((s, d) => s + d.calories, 0);
  const totalBurned = weekStats.reduce((s, d) => s + d.burned, 0);
  const avgCalories = Math.round(totalCalories / 7);
  const avgBurned = Math.round(totalBurned / 7);
  const avgNet = avgCalories - avgBurned;
  const activeDays = weekStats.filter((d) => d.calories > 0 || d.burned > 0).length;

  // 週間 PFC（直近7日）
  const weekMeals = weekStats.flatMap((d) => getMealsByDate(meals, d.date));
  const weekProtein = sumProtein(weekMeals);
  const weekFat = sumFat(weekMeals);
  const weekCarbs = sumCarbs(weekMeals);
  const hasPfc = weekProtein > 0 || weekFat > 0 || weekCarbs > 0;
  const avgProtein = Math.round((weekProtein / 7) * 10) / 10;
  const avgFat = Math.round((weekFat / 7) * 10) / 10;
  const avgCarbs = Math.round((weekCarbs / 7) * 10) / 10;

  // 今日のPFC
  const todayStr = todayString();
  const todayMeals = getMealsByDate(meals, todayStr);
  const todayProtein = sumProtein(todayMeals);
  const todayFat = sumFat(todayMeals);
  const todayCarbs = sumCarbs(todayMeals);
  const hasTodayPfc = todayProtein > 0 || todayFat > 0 || todayCarbs > 0;

  // PFC目標値（設定値またはデフォルト）
  const targetProtein = settings.targetProtein ?? DEFAULT_TARGET_PROTEIN;
  const targetFat = settings.targetFat ?? DEFAULT_TARGET_FAT;
  const targetCarbs = settings.targetCarbs ?? DEFAULT_TARGET_CARBS;

  const caloriesData = weekStats.map((d) => d.calories);
  const burnedData = weekStats.map((d) => d.burned);
  const allZeroCalories = caloriesData.every((v) => v === 0) && burnedData.every((v) => v === 0);

  const caloriesChartData = {
    labels: weekStats.map((d) => d.dayLabel),
    datasets: [
      {
        data: allZeroCalories ? caloriesData.map(() => 0.1) : caloriesData,
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: allZeroCalories ? burnedData.map(() => 0.1) : burnedData,
        color: (opacity = 1) => `rgba(255, 112, 67, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  // ─── 体重集計 ─────────────────────────────────────────────────────────────
  const today = new Date();
  const thisMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const sortedWeights = [...weights].sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = sortedWeights[0] ?? null;
  const thisMonthWeights = weights
    .filter((w) => w.date.startsWith(thisMonthStr))
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthlyChange =
    thisMonthWeights.length >= 2
      ? thisMonthWeights[thisMonthWeights.length - 1].weightKg - thisMonthWeights[0].weightKg
      : null;
  const recentWeights = sortedWeights.slice(0, 5);

  const weightForChart = [...weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const hasWeightData = weightForChart.length >= 2;
  const weightChartData = hasWeightData ? {
    labels: weightForChart.map((w) => {
      const [, m, d] = w.date.split('-');
      return `${parseInt(m)}/${parseInt(d)}`;
    }),
    datasets: [{
      data: weightForChart.map((w) => w.weightKg),
      color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
      strokeWidth: 2,
    }],
  } : null;

  const weightValues = weightForChart.map((w) => w.weightKg);
  const weightChartConfig = {
    ...BASE_CHART_CONFIG,
    decimalPlaces: 1,
  };

  // ─── BMI ─────────────────────────────────────────────────────────────────
  const bmi: number | null = (() => {
    if (!latestWeight || !settings.heightCm) return null;
    const hM = settings.heightCm / 100;
    return Math.round((latestWeight.weightKg / (hM * hM)) * 10) / 10;
  })();

  function bmiCategory(b: number) {
    if (b < 18.5) return '低体重';
    if (b < 25) return '普通体重';
    if (b < 30) return '過体重';
    return '肥満';
  }
  function bmiColor(b: number) {
    if (b < 18.5) return '#1E88E5';
    if (b < 25) return '#4CAF50';
    if (b < 30) return '#FF9800';
    return '#E53935';
  }
  function formatMonthlyChange(change: number) {
    return `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`;
  }

  // ─── Modal state ─────────────────────────────────────────────────────────
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightNoteInput, setWeightNoteInput] = useState('');

  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState(settings.targetWeightKg ? String(settings.targetWeightKg) : '');

  const [showHeightModal, setShowHeightModal] = useState(false);
  const [heightInput, setHeightInput] = useState(settings.heightCm ? String(settings.heightCm) : '');

  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeInput, setIntakeInput] = useState(settings.targetIntakeCalories ? String(settings.targetIntakeCalories) : '');

  const [showBurnedModal, setShowBurnedModal] = useState(false);
  const [burnedTargetInput, setBurnedTargetInput] = useState(settings.targetBurnedCalories ? String(settings.targetBurnedCalories) : '');

  // PFC目標 Modal
  const [showPfcTargetModal, setShowPfcTargetModal] = useState(false);
  const [pfcProteinInput, setPfcProteinInput] = useState(String(targetProtein));
  const [pfcFatInput, setPfcFatInput] = useState(String(targetFat));
  const [pfcCarbsInput, setPfcCarbsInput] = useState(String(targetCarbs));

  // CSVエクスポート Modal
  const [showExportModal, setShowExportModal] = useState(false);

  // ─── ハンドラ ─────────────────────────────────────────────────────────────
  function handleAddWeight() {
    const kg = parseFloat(weightInput);
    if (isNaN(kg) || kg <= 0 || kg > 300) {
      Alert.alert(t('common.error'), t('data.errorWeight'));
      return;
    }
    addWeight({ date: todayString(), weightKg: kg, note: weightNoteInput.trim() || undefined });
    setShowWeightModal(false);
    setWeightInput('');
    setWeightNoteInput('');
  }

  function handleSaveTarget() {
    const kg = parseFloat(targetInput);
    if (isNaN(kg) || kg <= 0 || kg > 300) {
      Alert.alert(t('common.error'), t('data.errorTargetWeight'));
      return;
    }
    updateSettings({ targetWeightKg: kg });
    setShowTargetModal(false);
  }

  function handleSaveHeight() {
    const cm = parseFloat(heightInput);
    if (isNaN(cm) || cm < 50 || cm > 250) {
      Alert.alert(t('common.error'), t('data.errorHeight'));
      return;
    }
    updateSettings({ heightCm: cm });
    setShowHeightModal(false);
  }

  function handleSaveIntake() {
    const kcal = parseInt(intakeInput, 10);
    if (isNaN(kcal) || kcal <= 0 || kcal > 10000) {
      Alert.alert(t('common.error'), t('data.errorIntake'));
      return;
    }
    updateSettings({ targetIntakeCalories: kcal });
    setShowIntakeModal(false);
  }

  function handleSaveBurned() {
    const kcal = parseInt(burnedTargetInput, 10);
    if (isNaN(kcal) || kcal <= 0 || kcal > 10000) {
      Alert.alert(t('common.error'), t('data.errorBurned'));
      return;
    }
    updateSettings({ targetBurnedCalories: kcal });
    setShowBurnedModal(false);
  }

  function handleSavePfcTarget() {
    const p = parseInt(pfcProteinInput, 10);
    const f = parseInt(pfcFatInput, 10);
    const c = parseInt(pfcCarbsInput, 10);
    if ([p, f, c].some((v) => isNaN(v) || v <= 0)) {
      Alert.alert(t('common.error'), t('data.errorPfc'));
      return;
    }
    updateSettings({ targetProtein: p, targetFat: f, targetCarbs: c });
    setShowPfcTargetModal(false);
  }

  // ─── CSV エクスポート ─────────────────────────────────────────────────────
  async function handleExport(period: '7' | '30' | 'all') {
    setShowExportModal(false);

    const now = new Date();
    const cutoff = period === 'all' ? null : (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - (period === '7' ? 7 : 30));
      return d.toISOString().slice(0, 10);
    })();

    const filteredMeals = cutoff ? meals.filter((m) => m.date >= cutoff) : meals;
    const filteredExercises = cutoff ? exercises.filter((e) => e.date >= cutoff) : exercises;

    const mealHeader = '日付,時刻,食事名,カロリー,区分,タンパク質(g),脂質(g),炭水化物(g)';
    const mealRows = filteredMeals.map((m) =>
      [m.date, m.time, `"${m.name}"`, m.calories, m.category,
        m.protein ?? '', m.fat ?? '', m.carbs ?? ''].join(',')
    );
    const mealCsv = [mealHeader, ...mealRows].join('\n');

    const exHeader = '日付,種目名,時間(分),消費カロリー,メモ';
    const exRows = filteredExercises.map((e) =>
      [e.date, `"${e.name}"`, e.durationMinutes, e.caloriesBurned, `"${e.note}"`].join(',')
    );
    const exCsv = [exHeader, ...exRows].join('\n');

    try {
      const mealPath = `${FileSystem.cacheDirectory}meal_records.csv`;
      const exPath = `${FileSystem.cacheDirectory}exercise_records.csv`;
      await FileSystem.writeAsStringAsync(mealPath, mealCsv, { encoding: FileSystem.EncodingType.UTF8 });
      await FileSystem.writeAsStringAsync(exPath, exCsv, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(t('common.error'), t('data.noShare'));
        return;
      }
      await Sharing.shareAsync(mealPath, { mimeType: 'text/csv', dialogTitle: '食事記録 CSV' });
      await Sharing.shareAsync(exPath, { mimeType: 'text/csv', dialogTitle: '運動記録 CSV' });
    } catch (e) {
      Alert.alert(t('data.exportError'), String(e));
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ─── カロリー折れ線グラフ ────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{t('data.caloriesChart')}</Text>
      <View style={styles.chartCard}>
        <LineChart
          data={caloriesChartData}
          width={CHART_WIDTH}
          height={180}
          chartConfig={BASE_CHART_CONFIG}
          bezier fromZero withInnerLines withOuterLines={false}
          style={styles.lineChart}
        />
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>{t('data.intake')}</Text>
          <View style={[styles.legendDot, { backgroundColor: '#FF7043' }]} />
          <Text style={styles.legendText}>{t('data.burned')}</Text>
        </View>
      </View>

      {/* ─── 週間サマリー ─────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{t('data.weeklySummary')}</Text>
      <View style={styles.summaryCard}>
        <StatRow label={t('data.avgIntake')} value={`${avgCalories} kcal`} sub={t('data.perDay')} />
        <View style={styles.divider} />
        <StatRow label={t('data.avgBurned')} value={`${avgBurned} kcal`} sub={t('data.perDay')} />
        <View style={styles.divider} />
        <StatRow label={t('data.avgNet')} value={`${avgNet} kcal`} sub={t('data.perDay')} />
        <View style={styles.divider} />
        <StatRow label={t('data.activeDays')} value={`${activeDays}${t('data.days')}`} sub={t('data.perWeek')} />
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t('data.streak')}</Text>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: streak >= 3 ? '#FF7043' : '#333' }]}>
              {streak}{t('data.days')}
            </Text>
            {streak >= 3 && <Text style={styles.statSub}>{t('data.streakContinue')}</Text>}
          </View>
        </View>
      </View>

      {/* ─── 週間 PFC ──────────────────────────────────────────────────── */}
      {hasPfc && (
        <>
          <Text style={styles.sectionTitle}>{t('data.weeklyPfc')}</Text>
          <View style={styles.pfcCard}>
            <View style={styles.pfcRow}>
              <View style={[styles.pfcBlock, { borderLeftColor: '#1E88E5' }]}>
                <Text style={styles.pfcBlockValue}>{avgProtein}g</Text>
                <Text style={styles.pfcBlockLabel}>🟦 {t('meal.proteinShort')}</Text>
              </View>
              <View style={[styles.pfcBlock, { borderLeftColor: '#FDD835' }]}>
                <Text style={styles.pfcBlockValue}>{avgFat}g</Text>
                <Text style={styles.pfcBlockLabel}>🟨 {t('meal.fatShort')}</Text>
              </View>
              <View style={[styles.pfcBlock, { borderLeftColor: '#4CAF50' }]}>
                <Text style={styles.pfcBlockValue}>{avgCarbs}g</Text>
                <Text style={styles.pfcBlockLabel}>🟩 {t('meal.carbsShort')}</Text>
              </View>
            </View>
            <Text style={styles.pfcTotal}>
              {t('data.weeklyPfcTotal')} — P: {weekProtein}g　F: {weekFat}g　C: {weekCarbs}g
            </Text>
          </View>
        </>
      )}

      {/* ─── 今日のPFC目標比較 ────────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t('data.todayPfc')}</Text>
        <TouchableOpacity
          style={styles.sectionEditBtn}
          onPress={() => {
            setPfcProteinInput(String(targetProtein));
            setPfcFatInput(String(targetFat));
            setPfcCarbsInput(String(targetCarbs));
            setShowPfcTargetModal(true);
          }}
        >
          <Text style={styles.sectionEditBtnText}>{t('data.pfcGoalSet')}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.summaryCard}>
        {hasTodayPfc ? (
          <>
            <PfcProgress label={`🟦 ${t('meal.proteinShort')}`} actual={todayProtein} target={targetProtein} color="#1E88E5" unit="g" />
            <View style={styles.divider} />
            <PfcProgress label={`🟨 ${t('meal.fatShort')}`} actual={todayFat} target={targetFat} color="#FDD835" unit="g" />
            <View style={styles.divider} />
            <PfcProgress label={`🟩 ${t('meal.carbsShort')}`} actual={todayCarbs} target={targetCarbs} color="#4CAF50" unit="g" />
          </>
        ) : (
          <Text style={styles.emptyChart}>{t('data.noTodayPfc')}</Text>
        )}
        <Text style={styles.pfcTargetNote}>
          {t('data.pfcDefaultNote', { p: targetProtein, f: targetFat, c: targetCarbs })}
        </Text>
      </View>

      {/* ─── 体重記録サマリー ─────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{t('data.weightRecord')}</Text>
      <View style={styles.summaryCard}>
        <StatRow
          label={t('data.currentWeight')}
          value={latestWeight ? `${latestWeight.weightKg} kg` : t('common.notSet')}
          sub={latestWeight ? latestWeight.date : undefined}
        />
        <View style={styles.divider} />
        <StatRow
          label={t('data.monthlyChange')}
          value={monthlyChange !== null ? formatMonthlyChange(monthlyChange) : '－'}
          sub={monthlyChange !== null ? `（${thisMonthWeights.length}件の記録）` : undefined}
        />
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t('data.targetWeight')}</Text>
          <View style={styles.targetRow}>
            <Text style={styles.statValue}>
              {settings.targetWeightKg ? `${settings.targetWeightKg} kg` : t('common.notSet')}
            </Text>
            <TouchableOpacity style={styles.targetEditBtn} onPress={() => {
              setTargetInput(settings.targetWeightKg ? String(settings.targetWeightKg) : '');
              setShowTargetModal(true);
            }}>
              <Text style={styles.targetEditBtnText}>{t('common.set')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t('data.targetIntake')}</Text>
          <View style={styles.targetRow}>
            <Text style={styles.statValue}>
              {settings.targetIntakeCalories ? `${settings.targetIntakeCalories} kcal` : t('common.notSet')}
            </Text>
            <TouchableOpacity style={styles.targetEditBtn} onPress={() => {
              setIntakeInput(settings.targetIntakeCalories ? String(settings.targetIntakeCalories) : '');
              setShowIntakeModal(true);
            }}>
              <Text style={styles.targetEditBtnText}>{t('common.set')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t('data.targetBurned')}</Text>
          <View style={styles.targetRow}>
            <Text style={styles.statValue}>
              {settings.targetBurnedCalories ? `${settings.targetBurnedCalories} kcal` : t('common.notSet')}
            </Text>
            <TouchableOpacity style={styles.targetEditBtn} onPress={() => {
              setBurnedTargetInput(settings.targetBurnedCalories ? String(settings.targetBurnedCalories) : '');
              setShowBurnedModal(true);
            }}>
              <Text style={styles.targetEditBtnText}>{t('common.set')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t('data.height')}</Text>
          <View style={styles.targetRow}>
            <Text style={styles.statValue}>
              {settings.heightCm ? `${settings.heightCm} cm` : t('common.notSet')}
            </Text>
            <TouchableOpacity style={styles.targetEditBtn} onPress={() => {
              setHeightInput(settings.heightCm ? String(settings.heightCm) : '');
              setShowHeightModal(true);
            }}>
              <Text style={styles.targetEditBtnText}>{t('common.set')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.addWeightBtn} onPress={() => setShowWeightModal(true)}>
          <Text style={styles.addWeightBtnText}>{t('data.recordWeight')}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── BMIカード ────────────────────────────────────────────────── */}
      {bmi !== null && (
        <>
          <Text style={styles.sectionTitle}>{t('data.bmi')}</Text>
          <View style={styles.bmiCard}>
            <Text style={[styles.bmiValue, { color: bmiColor(bmi) }]}>{bmi}</Text>
            <View style={[styles.bmiCategoryBadge, { backgroundColor: bmiColor(bmi) + '22' }]}>
              <Text style={[styles.bmiCategoryText, { color: bmiColor(bmi) }]}>
                {bmiCategory(bmi)}
              </Text>
            </View>
            <Text style={styles.bmiFormula}>
              {latestWeight?.weightKg} kg ÷ ({settings.heightCm} cm)²
            </Text>
          </View>
        </>
      )}
      {!settings.heightCm && (
        <>
          <Text style={styles.sectionTitle}>{t('data.bmi')}</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.emptyChart}>{t('data.bmiSetHeight')}</Text>
          </View>
        </>
      )}

      {/* ─── 体重グラフ ──────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{t('data.weightChart')}</Text>
      {hasWeightData && weightChartData ? (
        <View style={styles.chartCard}>
          <LineChart
            data={weightChartData}
            width={CHART_WIDTH}
            height={160}
            chartConfig={{ ...weightChartConfig, color: (opacity = 1) => `rgba(200, 200, 200, ${opacity})` }}
            bezier fromZero={false} yAxisSuffix=" kg"
            withInnerLines withOuterLines={false}
            style={styles.lineChart} segments={4}
          />
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>{t('data.weightChartLabel', { n: weightForChart.length })}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.summaryCard}>
          <Text style={styles.emptyChart}>
            {weights.length === 0 ? t('data.noWeightRecord') : t('data.noWeightChart')}
          </Text>
        </View>
      )}

      {/* ─── 体重履歴 ────────────────────────────────────────────────── */}
      {recentWeights.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('data.weightHistory')}</Text>
          <View style={styles.summaryCard}>
            {recentWeights.map((w, i) => (
              <React.Fragment key={w.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.weightRow}>
                  <Text style={styles.weightDate}>{w.date}</Text>
                  <View style={styles.weightRight}>
                    <Text style={styles.weightKg}>{w.weightKg} kg</Text>
                    {w.note ? <Text style={styles.weightNote}>{w.note}</Text> : null}
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {/* ─── データエクスポート ────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{t('data.dataManage')}</Text>
      <View style={styles.summaryCard}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => setShowExportModal(true)}>
          <Text style={styles.exportBtnText}>{t('data.exportBtn')}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── 言語切り替え ────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{t('data.language')}</Text>
      <View style={styles.summaryCard}>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, currentLang === 'ja' && styles.langBtnActive]}
            onPress={() => setLanguage('ja')}
          >
            <Text style={[styles.langBtnText, currentLang === 'ja' && styles.langBtnTextActive]}>日本語</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, currentLang === 'en' && styles.langBtnActive]}
            onPress={() => setLanguage('en')}
          >
            <Text style={[styles.langBtnText, currentLang === 'en' && styles.langBtnTextActive]}>English</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Modals ──────────────────────────────────────────────────── */}

      {/* 体重追加 */}
      <Modal visible={showWeightModal} transparent animationType="slide" onRequestClose={() => setShowWeightModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('data.weightTitle')}</Text>
              <Text style={styles.modalLabel}>{t('data.weightKg')}</Text>
              <TextInput style={styles.modalInput} value={weightInput} onChangeText={setWeightInput}
                keyboardType="decimal-pad" placeholder={t('data.weightKgPlaceholder')} returnKeyType="next" autoFocus />
              <Text style={styles.modalLabel}>{t('data.weightMemo')}</Text>
              <TextInput style={styles.modalInput} value={weightNoteInput} onChangeText={setWeightNoteInput}
                placeholder={t('data.weightMemoPh')} returnKeyType="done" />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowWeightModal(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAddWeight}>
                  <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 身長設定 */}
      <Modal visible={showHeightModal} transparent animationType="slide" onRequestClose={() => setShowHeightModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('data.heightTitle')}</Text>
              <Text style={styles.modalLabel}>{t('data.heightLabel')}</Text>
              <TextInput style={styles.modalInput} value={heightInput} onChangeText={setHeightInput}
                keyboardType="decimal-pad" placeholder={t('data.heightPh')} returnKeyType="done" autoFocus />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowHeightModal(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveHeight}>
                  <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 目標体重設定 */}
      <Modal visible={showTargetModal} transparent animationType="slide" onRequestClose={() => setShowTargetModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('data.targetWeightTitle')}</Text>
              <Text style={styles.modalLabel}>{t('data.targetWeightLabel')}</Text>
              <TextInput style={styles.modalInput} value={targetInput} onChangeText={setTargetInput}
                keyboardType="decimal-pad" placeholder={t('data.targetWeightPh')} returnKeyType="done" autoFocus />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowTargetModal(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveTarget}>
                  <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 目標摂取カロリー設定 */}
      <Modal visible={showIntakeModal} transparent animationType="slide" onRequestClose={() => setShowIntakeModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('data.targetIntakeTitle')}</Text>
              <Text style={styles.modalLabel}>{t('data.targetIntakeLabel')}</Text>
              <TextInput style={styles.modalInput} value={intakeInput} onChangeText={setIntakeInput}
                keyboardType="numeric" placeholder={t('data.targetIntakePh')} returnKeyType="done" autoFocus />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowIntakeModal(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveIntake}>
                  <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 目標消費カロリー設定 */}
      <Modal visible={showBurnedModal} transparent animationType="slide" onRequestClose={() => setShowBurnedModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('data.targetBurnedTitle')}</Text>
              <Text style={styles.modalLabel}>{t('data.targetBurnedLabel')}</Text>
              <TextInput style={styles.modalInput} value={burnedTargetInput} onChangeText={setBurnedTargetInput}
                keyboardType="numeric" placeholder={t('data.targetBurnedPh')} returnKeyType="done" autoFocus />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBurnedModal(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveBurned}>
                  <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PFC目標設定 */}
      <Modal visible={showPfcTargetModal} transparent animationType="slide" onRequestClose={() => setShowPfcTargetModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('data.pfcGoalTitle')}</Text>
              <Text style={styles.modalLabel}>{t('meal.protein')}</Text>
              <TextInput style={styles.modalInput} value={pfcProteinInput} onChangeText={setPfcProteinInput}
                keyboardType="numeric" placeholder={`${DEFAULT_TARGET_PROTEIN}`} returnKeyType="next" autoFocus />
              <Text style={styles.modalLabel}>{t('meal.fat')}</Text>
              <TextInput style={styles.modalInput} value={pfcFatInput} onChangeText={setPfcFatInput}
                keyboardType="numeric" placeholder={`${DEFAULT_TARGET_FAT}`} returnKeyType="next" />
              <Text style={styles.modalLabel}>{t('meal.carbs')}</Text>
              <TextInput style={styles.modalInput} value={pfcCarbsInput} onChangeText={setPfcCarbsInput}
                keyboardType="numeric" placeholder={`${DEFAULT_TARGET_CARBS}`} returnKeyType="done" />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPfcTargetModal(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSavePfcTarget}>
                  <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CSVエクスポート期間選択 */}
      <Modal visible={showExportModal} transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('data.exportTitle')}</Text>
            <Text style={styles.exportModalNote}>{t('data.exportNote')}</Text>
            {(['7', '30', 'all'] as const).map((p) => (
              <TouchableOpacity key={p} style={styles.exportPeriodBtn} onPress={() => handleExport(p)}>
                <Text style={styles.exportPeriodBtnText}>
                  {p === '7' ? t('data.export7') : p === '30' ? t('data.export30') : t('data.exportAll')}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: 8 }]} onPress={() => setShowExportModal(false)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 16, fontWeight: '600', color: '#333',
    marginBottom: 10, marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10, marginTop: 8,
  },
  sectionEditBtn: {
    backgroundColor: '#E8F5E9', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: '#4CAF50',
  },
  sectionEditBtnText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  chartCard: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingTop: 16, paddingBottom: 4, paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    overflow: 'hidden',
  },
  lineChart: { marginLeft: -16, borderRadius: 12 },
  legendRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingBottom: 8, gap: 6,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#888', marginRight: 12 },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 10,
  },
  statLabel: { fontSize: 14, color: '#555' },
  statRight: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontSize: 15, fontWeight: '600', color: '#333' },
  statSub: { fontSize: 12, color: '#888' },
  divider: { height: 1, backgroundColor: '#F0F0F0' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  targetEditBtn: {
    backgroundColor: '#E8F5E9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#4CAF50',
  },
  targetEditBtnText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  addWeightBtn: {
    backgroundColor: '#4CAF50', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 16,
  },
  addWeightBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  emptyChart: { fontSize: 13, color: '#BDBDBD', textAlign: 'center', paddingVertical: 16 },
  langRow: { flexDirection: 'row', gap: 12 },
  langBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#4CAF50', alignItems: 'center',
  },
  langBtnActive: { backgroundColor: '#4CAF50' },
  langBtnText: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  langBtnTextActive: { color: '#fff' },
  bmiCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20,
    marginBottom: 20, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, gap: 8,
  },
  bmiValue: { fontSize: 52, fontWeight: 'bold' },
  bmiCategoryBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  bmiCategoryText: { fontSize: 15, fontWeight: '700' },
  bmiFormula: { fontSize: 12, color: '#BDBDBD', marginTop: 4 },
  pfcCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  pfcRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pfcBlock: {
    flex: 1, borderLeftWidth: 3, paddingLeft: 10,
    paddingVertical: 6, backgroundColor: '#FAFAFA', borderRadius: 6,
  },
  pfcBlockValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  pfcBlockLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  pfcTotal: { fontSize: 12, color: '#BDBDBD', textAlign: 'center' },
  // PFC Progress bar
  pfcProgressRow: { paddingVertical: 10 },
  pfcProgressHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  pfcProgressLabel: { fontSize: 14, color: '#555', fontWeight: '500' },
  pfcProgressValue: { fontSize: 13, fontWeight: '600' },
  pfcBarBg: {
    height: 8, backgroundColor: '#F0F0F0',
    borderRadius: 4, overflow: 'hidden',
  },
  pfcBarFill: { height: 8, borderRadius: 4 },
  pfcPct: { fontSize: 11, color: '#888', textAlign: 'right', marginTop: 3 },
  pfcTargetNote: { fontSize: 11, color: '#BDBDBD', textAlign: 'center', marginTop: 10 },
  // Weight
  weightRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 10,
  },
  weightDate: { fontSize: 13, color: '#888' },
  weightRight: { alignItems: 'flex-end' },
  weightKg: { fontSize: 15, fontWeight: '600', color: '#333' },
  weightNote: { fontSize: 12, color: '#BDBDBD', marginTop: 2 },
  // Export
  exportBtn: {
    backgroundColor: '#F5F5F5', borderRadius: 10,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  exportBtnText: { fontSize: 15, color: '#555', fontWeight: '600' },
  exportModalNote: { fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 20 },
  exportPeriodBtn: {
    backgroundColor: '#4CAF50', borderRadius: 10,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  exportPeriodBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 14 },
  modalInput: {
    backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12,
    fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#E0E0E0',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelBtn: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#666' },
  modalConfirmBtn: {
    flex: 1, backgroundColor: '#4CAF50', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});
