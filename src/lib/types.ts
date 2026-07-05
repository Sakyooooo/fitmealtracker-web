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
  taggedUserIds?: string[];      // 一緒に食べたフレンド（タイムラインでシェア可能に）
  sharedFromMealId?: string | null; // シェアで作成した記録の場合、コピー元 meal.id
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

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

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
  // ── 目標自動計算（GoalPlanner）用のプロフィール ──
  sex?: Sex;
  birthYear?: number;       // 年齢入力 → 西暦で保存（再計算時も陳腐化しない）
  activityLevel?: ActivityLevel;
  goalTargetDate?: string;  // "YYYY-MM-DD" 目標期日（残日数の算出と表示に使用）
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

/** Open Food Facts のバーコード検索結果（市販品の栄養） */
export type ProductLookupResult = {
  found: boolean;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  servingLabel: string | null;   // 例: "30 g" / "100gあたり"
  basis: 'serving' | '100g' | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  source: 'off';
};

/** 日本食品標準成分表（八訂）の1食品。値は可食部100gあたり。 */
export type FoodCompositionItem = {
  id: string;          // 食品番号（5桁）
  name: string;        // 食品名
  category: string;    // 食品群（例: 穀類）
  kcal: number;        // エネルギー kcal/100g
  p: number | null;    // たんぱく質 g/100g
  f: number | null;    // 脂質 g/100g
  c: number | null;    // 炭水化物 g/100g
  searchKey: string;   // 検索用に正規化した名前
};

/** ユーザーが自前登録した食品（マイ食品）。market品をバーコード紐付け可。 */
export type MyFood = {
  id: string;
  name: string;
  barcode?: string | null;        // 市販品のバーコード（任意）
  basis: 'serving' | '100g';      // calories/PFC の基準
  servingLabel?: string | null;   // 例: "1個" / "100gあたり"
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  createdAt: string;
  updatedAt: string;
};

/** レシピの材料1件。amount は動画・原文の表記をそのまま保持（例: "200g", "大さじ2"）。 */
export type RecipeIngredient = { name: string; amount: string | null };

/** レシピの登録元。manual=手入力 / youtube=動画解析 / text=レシピ文の貼り付け */
export type RecipeSource = 'manual' | 'youtube' | 'text';

/** ストックしたレシピ。栄養値は1人前あたりに正規化して保存する。 */
export type Recipe = {
  id: string;
  name: string;
  servings: number;                 // このレシピが何人前ぶんか
  ingredients: RecipeIngredient[];
  steps: string[];
  calories: number | null;          // 1人前あたり kcal
  protein: number | null;          // g
  fat: number | null;              // g
  carbs: number | null;            // g
  sourceType: RecipeSource;
  sourceUrl?: string | null;        // YouTube URL（youtube時のみ）
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 分量スライダーが駆動する栄養の基準量。表示値 = base × (unit==='100g' ? quantity/100 : quantity)。 */
export type NutritionBasis = {
  name: string;
  base: { kcal: number; p: number | null; f: number | null; c: number | null };
  unit: 'serving' | '100g';
  unitLabel: string;   // serving時の単位（"人前"/"個"/"杯"等）。100g時は使わない
  quantity: number;    // serving数 もしくは グラム数
  origin: 'ai' | 'db' | 'off' | 'composition' | 'myfood';
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

export type Comment = {
  id: string;
  from_user_id: string;
  record_id: string;
  record_type: 'meal' | 'exercise';
  body: string;
  created_at: string;
  display_name?: string | null;  // 投稿者の表示名（JOIN 済み）
  avatar_url?: string | null;     // 投稿者のアバター（JOIN 済み）
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
  time?: string;            // "HH:MM"（シェアで自分の記録へコピーする際に使用）
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  photoUrl?: string | null; // 食事写真の公開URL
  // 食事の共有（タグ付け）
  taggedMe?: boolean;        // 自分がこの投稿にタグ付けされているか
  alreadyShared?: boolean;   // 自分が既にこの投稿をシェア済みか
  // 運動のみ
  duration_minutes?: number;
  exercise_type?: string;
  // 共通
  note?: string | null;
  created_at: string;
  // リアクション
  reactions: Reaction[];
  my_reaction: ReactionEmoji | null;
  // コメント（新着順=作成順）
  comments: Comment[];
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
