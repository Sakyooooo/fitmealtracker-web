/**
 * i18n/index.ts
 *
 * i18next の初期化と言語永続化。
 *
 * 優先順位:
 *  1. AsyncStorage に保存された手動設定
 *  2. expo-localization で検出したデバイス言語
 *  3. フォールバック: 日本語
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ja from '../locales/ja.json';
import en from '../locales/en.json';

export const LANG_STORAGE_KEY = '@app_language';
export type AppLanguage = 'ja' | 'en';

// デバイス言語を同期的に検出
const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'en';
const defaultLang: AppLanguage = deviceLang === 'ja' ? 'ja' : 'en';

i18next.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: defaultLang,
  fallbackLng: 'ja',
  interpolation: { escapeValue: false },
  // キーが見つからない場合は日本語の翻訳を返す
  compatibilityJSON: 'v4',
});

// AsyncStorage から保存済み言語設定を非同期でロードして上書き
AsyncStorage.getItem(LANG_STORAGE_KEY).then((saved) => {
  if (saved === 'ja' || saved === 'en') {
    i18next.changeLanguage(saved);
  }
});

export async function setLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
  await i18next.changeLanguage(lang);
}

export default i18next;
