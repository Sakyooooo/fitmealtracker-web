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
  photoUrl?: string; // Supabase Storage 公開URL（同期後にセット）
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
  location?: string;        // 例: "東京・日本"
  avatarUrl?: string;       // プロフィール画像（リサイズ済み data URL）
};

export type MealAnalysisResult = {
  dishName: string | null;
  candidates: string[] | null;   // 料理名の候補（確信度順・最大3）
  estimatedCalories: number | null;
  confidence: number | null;
  notes: string | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  source?: 'db' | 'ai' | null;   // 'db'=栄養成分表ベース / 'ai'=AI推定
  matchedFood?: string | null;   // 成分表でヒットした料理名
  servingLabel?: string | null;  // 成分表の基準量（例: "1杯"）
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
  avatar_url?: string | null;   // プロフィール画像（data URL）
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
  avatarUrl?: string | null;   // 投稿者のプロフィール画像

  // 食事
  name: string;
  calories: number;
  date: string;
  // 食事のみ
  category?: string;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  photoUrl?: string | null; // 食事写真の公開URL
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

export type WorkoutSet = {
  name: string;
  weightKg: number;
  sets: number;
  reps: number;
};

export type GymSession = {
  id: string;
  startedAt: string;       // ISO string
  endedAt?: string;        // ISO string
  durationSec?: number;
  estimatedCaloriesBurned?: number;
  memo?: string;
  workoutSets?: WorkoutSet[];
  status: GymSessionStatus;
};
