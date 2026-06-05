export type MealCategory = '朝食' | '昼食' | '夕食' | '間食';

export type MealEntry = {
  id: string;
  name: string;
  calories: number;
  time: string;      // "HH:MM"
  category: MealCategory;
  date: string;      // "YYYY-MM-DD"
  note?: string;
  photoId?: string;
  photoUri?: string;
  protein?: number;  // g
  fat?: number;      // g
  carbs?: number;    // g
};

export type ExerciseType = 'normal' | 'gymSession';

export type ExerciseEntry = {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  date: string;      // "YYYY-MM-DD"
  note: string;
  type: ExerciseType;
};

export type WeightEntry = {
  id: string;
  date: string;      // "YYYY-MM-DD"
  weightKg: number;
  note?: string;
};

export type GymGoalType = 'calories' | 'time';

export type AppSettings = {
  targetWeightKg?: number;
  targetIntakeCalories?: number;
  targetBurnedCalories?: number;
  heightCm?: number;
  targetProtein?: number;
  targetFat?: number;
  targetCarbs?: number;
  gymGoalType?: GymGoalType;
  gymGoalValue?: number;
};

export type MealAnalysisResult = {
  dishName: string | null;
  estimatedCalories: number | null;
  confidence: number | null;
  notes: string | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
};

export type DayStat = {
  date: string;
  dayLabel: string;
  calories: number;
  burned: number;
};

// ── Friends ───────────────────────────────────────────────────────────────────

export type FriendStatus = 'pending' | 'accepted' | 'blocked';

/** Supabase users テーブルの行 */
export type FriendUser = {
  id: string;
  friend_code: string;
  display_name: string | null;
  created_at: string;
};

/** friendships テーブルの行（相手ユーザー情報を JOIN 済み） */
export type Friendship = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: FriendStatus;
  created_at: string;
  friend: FriendUser;   // 相手側のユーザー情報
};

// ── Timeline / Reactions ──────────────────────────────────────────────────────

export type ReactionEmoji = '💪' | '🔥' | '👍' | '🎉';

export type Reaction = {
  id: string;
  from_user_id: string;
  record_id: string;
  record_type: 'meal' | 'exercise';
  emoji: ReactionEmoji;
  created_at: string;
};

/** タイムラインの1アイテム（meal or exercise） */
export type TimelineItem = {
  id: string;
  type: 'meal' | 'exercise';
  user_id: string;
  display_name: string | null;
  friend_code: string;
  // 食事
  name: string;
  calories: number;
  date: string;
  // 食事のみ
  category?: string;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  // 運動のみ
  duration_minutes?: number;
  exercise_type?: string;
  // 共通
  note?: string | null;
  created_at: string;
  // リアクション
  reactions: Reaction[];
  my_reaction: ReactionEmoji | null;
};

export type GymSessionStatus = 'active' | 'completed' | 'canceled';

export type GymSession = {
  id: string;
  startedAt: string;       // ISO string
  endedAt?: string;        // ISO string
  durationSec?: number;
  estimatedCaloriesBurned?: number;
  memo?: string;
  status: GymSessionStatus;
};
