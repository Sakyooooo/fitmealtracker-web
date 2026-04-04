export type MealStackParamList = {
  MealList: undefined;
  AddMeal: undefined;
  EditMeal: { mealId: string };
  MealDetail: { mealId: string };
};

export type ExerciseStackParamList = {
  ExerciseList: undefined;
  AddExercise: undefined;
  EditExercise: { exerciseId: string };
  ExerciseDetail: { exerciseId: string };
};

export type CalendarStackParamList = {
  CalendarHome: undefined;
  DayDetail: { date: string }; // "YYYY-MM-DD"
};
