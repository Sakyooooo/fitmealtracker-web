# FitMealTracker — CLAUDE.md

## プロジェクト概要
食事管理・運動管理アプリ（MVP）。Expo + TypeScript で構築。

## 技術スタック
- **Expo** ~54.x (managed workflow)
- **React Native** 0.81.x
- **TypeScript** ~5.9.x (strict mode)
- **React Navigation** v7 — bottom-tabs ナビゲーション

## ディレクトリ構成
```
FitMealTracker/
├── App.tsx               # エントリーポイント（NavigationContainer）
├── navigation/
│   └── TabNavigator.tsx  # 下部タブ定義
├── screens/
│   ├── MealScreen.tsx    # 食事タブ
│   ├── ExerciseScreen.tsx # 運動タブ
│   ├── CalendarScreen.tsx # カレンダータブ
│   └── DataScreen.tsx    # データタブ
└── components/           # 共通UIコンポーネント
```

## 開発ルール
- 変更は必要最小限。毎回ビルドが通る状態を保つ。
- 新しい依存パッケージを追加するときは `npm install` を実行し、
  Expo と互換性があるバージョンを選ぶ。
- アイコンは `@expo/vector-icons` (Ionicons) を使用。
- カラーパレット: プライマリ `#4CAF50`（緑）、背景 `#F5F5F5`、テキスト `#333333`。

## 起動方法
```bash
npx expo start
```
