/**
 * components/PickerFields.tsx
 * クロスプラットフォームな日付・時刻ピッカーコンポーネント。
 * - Android: ネイティブダイアログとして表示
 * - iOS: Modal + スピナー + 完了ボタン
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function dateFromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? new Date() : date;
}

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateFromHM(s: string): Date {
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function hmFromDate(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── DatePickerField ──────────────────────────────────────────────────────────

type DatePickerFieldProps = {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
};

export function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState(() => dateFromYMD(value));

  function handleChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selected) onChange(ymdFromDate(selected));
    } else {
      if (selected) setTempDate(selected);
    }
  }

  function handleConfirm() {
    onChange(ymdFromDate(tempDate));
    setShow(false);
  }

  return (
    <View>
      <TouchableOpacity style={styles.btn} onPress={() => {
        setTempDate(dateFromYMD(value));
        setShow(true);
      }}>
        <Text style={styles.btnText}>{value || '日付を選択'}</Text>
        <Text style={styles.btnIcon}>📅</Text>
      </TouchableOpacity>

      {/* Android: ネイティブダイアログ */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={dateFromYMD(value)}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {/* iOS: Modal + スピナー */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.cancelText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.doneText}>完了</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── TimePickerField ──────────────────────────────────────────────────────────

type TimePickerFieldProps = {
  value: string; // HH:MM
  onChange: (value: string) => void;
};

export function TimePickerField({ value, onChange }: TimePickerFieldProps) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState(() => dateFromHM(value));

  function handleChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selected) onChange(hmFromDate(selected));
    } else {
      if (selected) setTempDate(selected);
    }
  }

  function handleConfirm() {
    onChange(hmFromDate(tempDate));
    setShow(false);
  }

  return (
    <View>
      <TouchableOpacity style={styles.btn} onPress={() => {
        setTempDate(dateFromHM(value));
        setShow(true);
      }}>
        <Text style={styles.btnText}>{value || '時刻を選択'}</Text>
        <Text style={styles.btnIcon}>🕐</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={dateFromHM(value)}
          mode="time"
          display="default"
          is24Hour
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.cancelText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.doneText}>完了</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="time"
                display="spinner"
                is24Hour
                onChange={handleChange}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── スタイル ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  btnText: { fontSize: 15, color: '#333' },
  btnIcon: { fontSize: 16 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cancelText: { fontSize: 16, color: '#888' },
  doneText: { fontSize: 16, color: '#4CAF50', fontWeight: '700' },
});
