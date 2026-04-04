/**
 * components/ActivitySuggest.tsx
 * 運動種目入力補助コンポーネント。
 * 入力テキストに部分一致する種目を横スクロールのチップで表示する。
 */
import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { KNOWN_ACTIVITIES } from '../services/exercise';

type Props = {
  input: string;
  onSelect: (activity: string) => void;
};

export function ActivitySuggest({ input, onSelect }: Props) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const suggestions = KNOWN_ACTIVITIES.filter(
    (a) => a.includes(trimmed) || trimmed.includes(a),
  );

  if (suggestions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.rowContent}
      keyboardShouldPersistTaps="handled"
    >
      {suggestions.map((activity) => (
        <TouchableOpacity
          key={activity}
          style={styles.chip}
          onPress={() => onSelect(activity)}
        >
          <Text style={styles.chipText}>{activity}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 8 },
  rowContent: { paddingBottom: 4 },
  chip: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#FF7043',
  },
  chipText: { fontSize: 13, color: '#FF7043', fontWeight: '600' },
});
