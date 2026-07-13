import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GymSessionCard from './GymSessionCard';
import { estimateExerciseCalories } from '@/lib/activities';
import { makeGymSession } from '@/test/factories';

// jsdom には WebGL が無いため、3Dアバターステージはモックする
vi.mock('./ExerciseAvatarStage', () => ({ default: () => null }));

const baseProps = {
  session: null,
  todayBurned: 0,
  todayMinutes: 0,
  gymGoal: undefined,
  onStart: vi.fn(),
  onEnd: vi.fn(),
  onCancel: vi.fn(),
  onMemoChange: vi.fn(),
  onSave: vi.fn(),
  onAddManual: vi.fn(),
  onGoalSetting: vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────
describe('GymSessionCard — Idle（セッションなし）', () => {
  it('START ボタンが表示される', () => {
    render(<GymSessionCard {...baseProps} />);
    expect(screen.getByText('START')).toBeInTheDocument();
  });

  it('START ボタンクリックで onStart が呼ばれる', () => {
    const onStart = vi.fn();
    render(<GymSessionCard {...baseProps} onStart={onStart} />);
    fireEvent.click(screen.getByText('START'));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('目標設定ボタンクリックで onGoalSetting が呼ばれる', () => {
    const onGoalSetting = vi.fn();
    render(<GymSessionCard {...baseProps} onGoalSetting={onGoalSetting} />);
    fireEvent.click(screen.getByText('目標設定'));
    expect(onGoalSetting).toHaveBeenCalledOnce();
  });

  it('目標が設定されているとき、ゴールラベルが表示される', () => {
    render(<GymSessionCard {...baseProps} gymGoal={{ type: 'calories', value: 300 }} />);
    expect(screen.getByText('300 kcal')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GymSessionCard — Active（セッション中）', () => {
  const activeSession = makeGymSession({ status: 'active' });

  it('【バグ再現】gymGoal が undefined でもクラッシュしない', () => {
    // 修正前はここで TypeError: Cannot read properties of undefined (reading 'value')
    expect(() =>
      render(<GymSessionCard {...baseProps} session={activeSession} gymGoal={undefined} />),
    ).not.toThrow();
  });

  it('LIVE インジケーターが表示される', () => {
    render(<GymSessionCard {...baseProps} session={activeSession} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('終了ボタンクリックで onEnd が呼ばれる', () => {
    const onEnd = vi.fn();
    render(<GymSessionCard {...baseProps} session={activeSession} onEnd={onEnd} />);
    fireEvent.click(screen.getByText('終了'));
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('× ボタンクリックで onCancel が呼ばれる', () => {
    const onCancel = vi.fn();
    render(<GymSessionCard {...baseProps} session={activeSession} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('×'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('目標あり・タイプ time でもクラッシュしない', () => {
    expect(() =>
      render(<GymSessionCard {...baseProps} session={activeSession} gymGoal={{ type: 'time', value: 60 }} todayMinutes={10} />),
    ).not.toThrow();
  });

  it('種目チップのタップでチェックが付き、再タップで外れる（トグル）', () => {
    render(<GymSessionCard {...baseProps} session={activeSession} />);
    const chip = screen.getByText('ベンチプレス');
    fireEvent.click(chip);
    expect(screen.getByText('✓ ベンチプレス')).toBeInTheDocument();
    fireEvent.click(screen.getByText('✓ ベンチプレス'));
    expect(screen.queryByText('✓ ベンチプレス')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GymSessionCard — Completed（完了）', () => {
  const completedSession = makeGymSession({
    status: 'completed',
    endedAt: new Date().toISOString(),
    durationSec: 1800,
  });

  it('「完了」ヘッダーが表示される', () => {
    render(<GymSessionCard {...baseProps} session={completedSession} />);
    expect(screen.getByText('完了')).toBeInTheDocument();
  });

  it('保存ボタンが表示される', () => {
    render(<GymSessionCard {...baseProps} session={completedSession} />);
    expect(screen.getByText('保存')).toBeInTheDocument();
  });

  it('カロリーは所要時間から自動プレフィルされる', () => {
    const estimated = estimateExerciseCalories('ジムセッション', 30); // 1800秒 = 30分
    render(<GymSessionCard {...baseProps} session={completedSession} />);
    expect(screen.getByDisplayValue(String(estimated))).toBeInTheDocument();
  });

  it('未入力操作なしでも保存でき、onSave に推定カロリーが渡る（入力を強制しない）', () => {
    const estimated = estimateExerciseCalories('ジムセッション', 30);
    const onSave = vi.fn();
    render(<GymSessionCard {...baseProps} session={completedSession} onSave={onSave} />);
    fireEvent.click(screen.getByText('保存'));
    expect(onSave).toHaveBeenCalledWith(estimated, [], []);
  });

  it('カロリーを手動修正した場合はその値で保存される', () => {
    const onSave = vi.fn();
    render(<GymSessionCard {...baseProps} session={completedSession} onSave={onSave} />);
    const input = screen.getByPlaceholderText('0');
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.click(screen.getByText('保存'));
    expect(onSave).toHaveBeenCalledWith(500, [], []);
  });
});
