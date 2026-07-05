'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { MealEntry, MealAnalysisResult } from '@/lib/types';
import { useMealForm, type TagFriend } from './useMealForm';
import QuickMealForm from './QuickMealForm';
import DetailMealForm from './DetailMealForm';

type Mode = 'quick' | 'detail';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<MealEntry, 'id' | 'photoUri' | 'photoId'> & { photoFile?: File | null },
  ) => void;
  initialPhotoFile?: File | null;
  initialAnalysis?: MealAnalysisResult | null;
  friends?: TagFriend[];
};

export default function AddMealModal({ open, onClose, onSave, initialPhotoFile, initialAnalysis, friends }: Props) {
  const [mode, setMode] = useState<Mode>('quick');
  const form = useMealForm({ open, onClose, onSave, initialPhotoFile, initialAnalysis });

  // 写真付き / PFC 付きで開かれたときは詳細モードで開く
  // （クイックモードには写真・PFC 欄が無いため）
  useEffect(() => {
    if (!open) return;
    const hasPfc = !!initialAnalysis &&
      (initialAnalysis.protein !== null || initialAnalysis.fat !== null || initialAnalysis.carbs !== null);
    setMode(initialPhotoFile || hasPfc ? 'detail' : 'quick');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={form.handleClose} title="食事を追加">
      {/* ── モード切り替えタブ ── */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {(['quick', 'detail'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {m === 'quick' ? '⚡ クイック' : '✏️ 詳細'}
          </button>
        ))}
      </div>

      {mode === 'quick'
        ? <QuickMealForm form={form} friends={friends} />
        : <DetailMealForm form={form} friends={friends} />}
    </Modal>
  );
}
