import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

// i18n を副作用として初期化（最初にインポート）
import './i18n';

import { AppProvider, useAppContext } from './hooks/AppContext';
import TabNavigator from './navigation/TabNavigator';

function AppContent() {
  const { isLoading } = useAppContext();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <TabNavigator />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </AppProvider>
  );
}
