/**
 * services/imagePicker.ts
 *
 * 画像選択・撮影・永続化の責務を担うサービス。
 * UI 依存（Alert）を含むため expo-image-picker と expo-file-system/legacy に閉じている。
 *
 * 将来の拡張ポイント:
 *   - UIKit / Photo Library API v2 への移行
 *   - クラウドストレージへのアップロード対応
 */

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

const PHOTO_DIR = `${FileSystem.documentDirectory}fitmeal_photos/`;

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

async function ensurePhotoDirExists(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * 一時 URI をアプリの documentDirectory にコピーして永続化する。
 * キャッシュクリアや OS の一時ファイル削除でも写真が消えなくなる。
 */
export async function savePhotoToAppDir(tempUri: string): Promise<string> {
  await ensurePhotoDirExists();
  const ext = tempUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `photo_${Date.now()}.${ext}`;
  const dest = `${PHOTO_DIR}${filename}`;
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

/**
 * フォトライブラリから画像を選択する。
 * 権限要求・保存を一括処理。キャンセル/権限拒否時は null を返す。
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    Alert.alert('権限が必要です', '写真ライブラリへのアクセスを許可してください');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return savePhotoToAppDir(result.assets[0].uri);
}

/**
 * カメラで撮影する。
 * 権限要求・保存を一括処理。キャンセル/権限拒否時は null を返す。
 */
export async function takePhotoWithCamera(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== 'granted') {
    Alert.alert('権限が必要です', 'カメラへのアクセスを許可してください');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return savePhotoToAppDir(result.assets[0].uri);
}
