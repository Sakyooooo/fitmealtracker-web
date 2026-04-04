import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import MealScreen from '../screens/MealScreen';
import AddMealScreen from '../screens/AddMealScreen';
import EditMealScreen from '../screens/EditMealScreen';
import MealDetailScreen from '../screens/MealDetailScreen';
import ExerciseScreen from '../screens/ExerciseScreen';
import AddExerciseScreen from '../screens/AddExerciseScreen';
import EditExerciseScreen from '../screens/EditExerciseScreen';
import ExerciseDetailScreen from '../screens/ExerciseDetailScreen';
import CalendarScreen from '../screens/CalendarScreen';
import DayDetailScreen from '../screens/DayDetailScreen';
import DataScreen from '../screens/DataScreen';

import {
  MealStackParamList,
  ExerciseStackParamList,
  CalendarStackParamList,
} from './types';

export type RootTabParamList = {
  食事: undefined;
  運動: undefined;
  カレンダー: undefined;
  データ: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const MealStack = createNativeStackNavigator<MealStackParamList>();
const ExerciseStack = createNativeStackNavigator<ExerciseStackParamList>();
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();

const GREEN_HEADER = {
  headerStyle: { backgroundColor: '#4CAF50' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

const ORANGE_HEADER = {
  headerStyle: { backgroundColor: '#FF7043' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

function MealNavigator() {
  const { t } = useTranslation();
  return (
    <MealStack.Navigator screenOptions={GREEN_HEADER}>
      <MealStack.Screen name="MealList" component={MealScreen} options={{ title: t('meal.screenTitle') }} />
      <MealStack.Screen name="AddMeal" component={AddMealScreen} options={{ title: t('meal.addTitle') }} />
      <MealStack.Screen name="EditMeal" component={EditMealScreen} options={{ title: t('meal.editTitle') }} />
      <MealStack.Screen name="MealDetail" component={MealDetailScreen} options={{ title: t('meal.detailTitle') }} />
    </MealStack.Navigator>
  );
}

function ExerciseNavigator() {
  const { t } = useTranslation();
  return (
    <ExerciseStack.Navigator screenOptions={ORANGE_HEADER}>
      <ExerciseStack.Screen name="ExerciseList" component={ExerciseScreen} options={{ title: t('exercise.screenTitle') }} />
      <ExerciseStack.Screen name="AddExercise" component={AddExerciseScreen} options={{ title: t('exercise.addTitle') }} />
      <ExerciseStack.Screen name="EditExercise" component={EditExerciseScreen} options={{ title: t('exercise.editTitle') }} />
      <ExerciseStack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: t('exercise.detailTitle') }} />
    </ExerciseStack.Navigator>
  );
}

function CalendarNavigator() {
  const { t } = useTranslation();
  return (
    <CalendarStack.Navigator screenOptions={GREEN_HEADER}>
      <CalendarStack.Screen
        name="CalendarHome"
        component={CalendarScreen}
        options={{ title: t('tab.calendar') }}
      />
      <CalendarStack.Screen
        name="DayDetail"
        component={DayDetailScreen}
        options={({ route }) => {
          const [, m, d] = route.params.date.split('-');
          return { title: t('calendar.dayDetail', { month: parseInt(m), day: parseInt(d) }) };
        }}
      />
    </CalendarStack.Navigator>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof RootTabParamList, { active: IoniconName; inactive: IoniconName }> = {
  食事: { active: 'restaurant', inactive: 'restaurant-outline' },
  運動: { active: 'barbell', inactive: 'barbell-outline' },
  カレンダー: { active: 'calendar', inactive: 'calendar-outline' },
  データ: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};

export default function TabNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#4CAF50' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E0E0E0' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof RootTabParamList];
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="食事" component={MealNavigator}
        options={{ headerShown: false, tabBarLabel: t('tab.meal') }} />
      <Tab.Screen name="運動" component={ExerciseNavigator}
        options={{ headerShown: false, tabBarLabel: t('tab.exercise') }} />
      <Tab.Screen name="カレンダー" component={CalendarNavigator}
        options={{ headerShown: false, tabBarLabel: t('tab.calendar') }} />
      <Tab.Screen name="データ" component={DataScreen}
        options={{ title: t('tab.data'), tabBarLabel: t('tab.data') }} />
    </Tab.Navigator>
  );
}
