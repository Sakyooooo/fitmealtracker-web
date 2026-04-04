import { MealEntry, ExerciseEntry } from '../types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const INITIAL_MEALS: MealEntry[] = [
  { id: 'm1', name: '玄米ご飯・味噌汁・焼き魚', calories: 520, time: '07:30', category: '朝食', date: daysAgo(0) },
  { id: 'm2', name: 'サラダチキン・野菜スープ', calories: 380, time: '12:00', category: '昼食', date: daysAgo(0) },
  { id: 'm3', name: 'バナナ・ヨーグルト', calories: 180, time: '15:00', category: '間食', date: daysAgo(0) },
  { id: 'm4', name: '鶏むね肉・ブロッコリー・白米', calories: 620, time: '19:30', category: '夕食', date: daysAgo(0) },
  { id: 'm5', name: 'トースト・目玉焼き', calories: 420, time: '08:00', category: '朝食', date: daysAgo(1) },
  { id: 'm6', name: 'パスタ・サラダ', calories: 580, time: '12:30', category: '昼食', date: daysAgo(1) },
  { id: 'm7', name: 'スパゲッティ・ミートソース', calories: 680, time: '19:00', category: '夕食', date: daysAgo(1) },
  { id: 'm8', name: 'オートミール・フルーツ', calories: 350, time: '07:00', category: '朝食', date: daysAgo(2) },
  { id: 'm9', name: '定食（魚・野菜）', calories: 620, time: '12:00', category: '昼食', date: daysAgo(2) },
  { id: 'm10', name: 'プロテインバー', calories: 200, time: '16:00', category: '間食', date: daysAgo(2) },
  { id: 'm11', name: '焼き鳥・野菜炒め', calories: 550, time: '20:00', category: '夕食', date: daysAgo(2) },
  { id: 'm12', name: 'シリアル・牛乳', calories: 380, time: '07:30', category: '朝食', date: daysAgo(3) },
  { id: 'm13', name: 'おにぎり・みそ汁', calories: 420, time: '12:00', category: '昼食', date: daysAgo(3) },
  { id: 'm14', name: '豚の生姜焼き定食', calories: 750, time: '19:30', category: '夕食', date: daysAgo(3) },
  { id: 'm15', name: 'パン・コーヒー', calories: 280, time: '08:00', category: '朝食', date: daysAgo(4) },
  { id: 'm16', name: '唐揚げ弁当', calories: 780, time: '13:00', category: '昼食', date: daysAgo(4) },
  { id: 'm17', name: 'アイス', calories: 250, time: '15:30', category: '間食', date: daysAgo(4) },
  { id: 'm18', name: 'カレーライス', calories: 850, time: '19:00', category: '夕食', date: daysAgo(4) },
  { id: 'm19', name: 'ヨーグルト・グラノーラ', calories: 320, time: '07:30', category: '朝食', date: daysAgo(5) },
  { id: 'm20', name: 'ランチサラダ', calories: 350, time: '12:00', category: '昼食', date: daysAgo(5) },
  { id: 'm21', name: 'グリル野菜・ご飯', calories: 580, time: '19:00', category: '夕食', date: daysAgo(5) },
  { id: 'm22', name: '卵かけご飯・納豆', calories: 450, time: '08:00', category: '朝食', date: daysAgo(6) },
  { id: 'm23', name: '冷やし中華', calories: 650, time: '12:30', category: '昼食', date: daysAgo(6) },
  { id: 'm24', name: '刺身定食', calories: 600, time: '19:00', category: '夕食', date: daysAgo(6) },
];

export const INITIAL_EXERCISES: ExerciseEntry[] = [
  { id: 'e1', name: 'ジョギング', durationMinutes: 30, caloriesBurned: 280, date: daysAgo(0), note: '', type: 'normal' },
  { id: 'e2', name: '筋トレ（胸・肩）', durationMinutes: 45, caloriesBurned: 220, date: daysAgo(0), note: '', type: 'normal' },
  { id: 'e3', name: 'ストレッチ', durationMinutes: 15, caloriesBurned: 40, date: daysAgo(0), note: '寝る前', type: 'normal' },
  { id: 'e4', name: 'ウォーキング', durationMinutes: 45, caloriesBurned: 200, date: daysAgo(1), note: '', type: 'normal' },
  { id: 'e5', name: 'スクワット', durationMinutes: 20, caloriesBurned: 120, date: daysAgo(1), note: '', type: 'normal' },
  { id: 'e6', name: 'ランニング', durationMinutes: 40, caloriesBurned: 380, date: daysAgo(2), note: '5km走った', type: 'normal' },
  { id: 'e7', name: 'サイクリング', durationMinutes: 60, caloriesBurned: 350, date: daysAgo(4), note: '', type: 'normal' },
  { id: 'e8', name: '腹筋・腕立て', durationMinutes: 25, caloriesBurned: 130, date: daysAgo(4), note: '', type: 'normal' },
  { id: 'e9', name: 'ヨガ', durationMinutes: 60, caloriesBurned: 200, date: daysAgo(5), note: '', type: 'normal' },
  { id: 'e10', name: 'ジョギング', durationMinutes: 35, caloriesBurned: 320, date: daysAgo(6), note: '', type: 'normal' },
];
