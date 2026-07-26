import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TimelineCard from './TimelineCard';
import { TimelineItem } from '@/lib/types';

function makeItem(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: 'item-1',
    type: 'meal',
    user_id: 'u1',
    display_name: 'みさき',
    friend_code: 'FMT-0001',
    name: 'ポキ丼',
    calories: 612,
    date: '2026-07-26',
    category: '昼食',
    photoUrl: 'https://example.test/poke.jpg',
    created_at: new Date().toISOString(),
    reactions: [],
    my_reaction: null,
    comments: [],
    ...overrides,
  };
}

const baseProps = {
  onReact: vi.fn(),
  onAddComment: vi.fn(),
  onDeleteComment: vi.fn(),
  meId: 'me',
};

describe('TimelineCard — 写真の画角', () => {
  it('画角が未指定なら中央（従来と同じ見え方）', () => {
    render(<TimelineCard {...baseProps} item={makeItem()} />);
    const img = screen.getByAltText('ポキ丼');
    expect(img).toHaveStyle({ objectPosition: '50% 50%' });
  });

  it('保存された画角を object-position に反映する', () => {
    render(<TimelineCard {...baseProps} item={makeItem({ photoFocusX: 40, photoFocusY: 25 })} />);
    expect(screen.getByAltText('ポキ丼')).toHaveStyle({ objectPosition: '40% 25%' });
  });
});

describe('TimelineCard — 写真タップで全画面', () => {
  it('写真をタップすると全画面ビューアが開き、閉じるとなくなる', () => {
    render(<TimelineCard {...baseProps} item={makeItem()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '写真を全画面で見る' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // 全画面では切り抜かず写真全体を表示する
    expect(within(dialog).getByAltText('ポキ丼')).toHaveClass('object-contain');

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('写真が無い投稿には全画面ボタンを出さない', () => {
    render(<TimelineCard {...baseProps} item={makeItem({ photoUrl: null })} />);
    expect(screen.queryByRole('button', { name: '写真を全画面で見る' })).not.toBeInTheDocument();
  });
});
