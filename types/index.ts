export type MealCategory = '朝食' | '昼食' | '夕食' | '間食';

export type MealEntry = {
  id: string;
  name: string;
  calories: number;
  time: string;         // "HH:MM"
  category: MealCategory;
  date: string;         // "YYYY-MM-DD"
  note?: string;
  photoUri?: string;    // file:// URI in documentDirectory
  // PFC 栄養素（任意。写真解析または手動入力）
  protein?: number;     // タンパク質 (g)
  fat?: number;         // 脂質 (g)
  carbs?: number;       // 炭水化物 (g)
};

export type ExerciseType = 'normal' | 'gymSession';

export type ExerciseEntry = {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  date: string;         // "YYYY-MM-DD"
  note: string;
  type: ExerciseType;
};

export type GymSessionStatus = 'active' | 'completed';

export type GymSession = {
  id: string;
  startedAt: string;    // ISO string
  endedAt?: string;     // ISO string
  durationMinutes?: number;
  caloriesBurned?: number;
  note: string;
  status: GymSessionStatus;
};

export type WeightEntry = {
  id: string;
  date: string;         // "YYYY-MM-DD"
  weightKg: number;
  note?: string;
};

export type AppSettings = {
  targetWeightKg?: number;
  targetIntakeCalories?: number;   // 目標摂取カロリー (kcal/日)
  targetBurnedCalories?: number;   // 目標消費カロリー (kcal/日)
  heightCm?: number;               // 身長 (cm) — BMI計算用
  targetProtein?: number;          // 目標タンパク質 (g/日)
  targetFat?: number;              // 目標脂質 (g/日)
  targetCarbs?: number;            // 目標炭水化物 (g/日)
};

// 将来の写真解析APIが返す結果型
// analyzeMealPhoto / estimateMealCaloriesFromPhoto の戻り値として使う
export type MealAnalysisResult = {
  dishName: string | null;           // 推定された料理名
  estimatedCalories: number | null;  // 推定カロリー (kcal)
  confidence: number | null;         // 信頼度 0.0〜1.0
  notes: string | null;              // 補足説明（推定根拠、注意点など）
  // PFC 栄養素推定（バックエンド接続後に取得可能）
  protein: number | null;            // タンパク質 (g)
  fat: number | null;                // 脂質 (g)
  carbs: number | null;              // 炭水化物 (g)
  rawLabels?: string[];              // Vision API などが返す生ラベル（将来用）
};
