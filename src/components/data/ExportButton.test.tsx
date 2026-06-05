import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportButton from './ExportButton';
import { makeMeal, makeExercise } from '@/test/factories';

// URL.createObjectURL / revokeObjectURL は jsdom 未実装なのでスタブ化
beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  // <a>.click() を空実装に（ダウンロードを抑制）
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const meals = [
  makeMeal({ date: '2026-06-05', calories: 500 }),
  makeMeal({ date: '2026-05-28', calories: 800 }),
];
const exercises = [makeExercise({ date: '2026-06-05', caloriesBurned: 300 })];

// ─────────────────────────────────────────────────────────────────────────────
describe('ExportButton — 表示', () => {
  it('エクスポートボタンが表示される', () => {
    render(<ExportButton meals={meals} exercises={exercises} />);
    expect(screen.getByRole('button', { name: /エクスポート/ })).toBeInTheDocument();
  });

  it('インポートボタンが表示される', () => {
    render(<ExportButton meals={meals} exercises={exercises} />);
    expect(screen.getByRole('button', { name: /インポート/ })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ExportButton — モーダル開閉', () => {
  it('エクスポートボタンクリックでモーダルが開く', async () => {
    render(<ExportButton meals={meals} exercises={exercises} />);
    fireEvent.click(screen.getByRole('button', { name: /エクスポート/ }));
    await waitFor(() => {
      expect(screen.getByText('全期間')).toBeInTheDocument();
    });
  });

  it('キャンセルクリックでモーダルが閉じる', async () => {
    render(<ExportButton meals={meals} exercises={exercises} />);
    fireEvent.click(screen.getByRole('button', { name: /エクスポート/ }));
    await waitFor(() => screen.getByText('キャンセル'));
    fireEvent.click(screen.getByText('キャンセル'));
    await waitFor(() => {
      expect(screen.queryByText('全期間')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ExportButton — CSV エクスポート', () => {
  it('全期間クリックで createObjectURL が呼ばれる（Blob 生成）', async () => {
    render(<ExportButton meals={meals} exercises={exercises} />);
    fireEvent.click(screen.getByRole('button', { name: /エクスポート/ }));
    await waitFor(() => screen.getByText('全期間'));
    fireEvent.click(screen.getByText('全期間'));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('直近7日クリックでも createObjectURL が呼ばれる', async () => {
    render(<ExportButton meals={meals} exercises={exercises} />);
    fireEvent.click(screen.getByRole('button', { name: /エクスポート/ }));
    await waitFor(() => screen.getByText('直近7日'));
    fireEvent.click(screen.getByText('直近7日'));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ExportButton — JSON エクスポート', () => {
  it('JSON を選択してエクスポートすると createObjectURL が呼ばれる', async () => {
    render(<ExportButton meals={meals} exercises={exercises} />);
    fireEvent.click(screen.getByRole('button', { name: /エクスポート/ }));
    await waitFor(() => screen.getByRole('button', { name: 'JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    fireEvent.click(screen.getByText('全期間'));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ExportButton — インポート（不正ファイル）', () => {
  it('不正な JSON ファイルを読み込むとアラートが出る', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ExportButton meals={meals} exercises={exercises} />);

    const input = document.querySelector('input[type="file"][accept*="json"]') as HTMLInputElement;
    const file = new File(['not json!!!'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/失敗|形式/));
    });
  });

  it('空データの JSON を読み込むとアラートが出る', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ExportButton meals={meals} exercises={exercises} />);

    const input = document.querySelector('input[type="file"][accept*="json"]') as HTMLInputElement;
    const file = new File(['{"meals":[],"exercises":[]}'], 'empty.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/見つかりません/));
    });
    confirmMock.mockRestore();
  });
});
