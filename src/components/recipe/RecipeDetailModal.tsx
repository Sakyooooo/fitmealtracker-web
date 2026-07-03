'use client';

import Modal from '@/components/ui/Modal';
import { Recipe } from '@/lib/types';
import { extractYouTubeVideoId, youtubeThumbnailUrl } from '@/lib/recipe';

type Props = {
  recipe: Recipe | null;
  onClose: () => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onRecord: (recipe: Recipe) => void;
};

export default function RecipeDetailModal({ recipe, onClose, onEdit, onDelete, onRecord }: Props) {
  if (!recipe) return null;

  const videoId = recipe.sourceUrl ? extractYouTubeVideoId(recipe.sourceUrl) : null;

  function handleDelete() {
    if (!recipe) return;
    if (confirm(`「${recipe.name}」を削除しますか？`)) onDelete(recipe.id);
  }

  return (
    <Modal open onClose={onClose} title={recipe.name}>
      <div className="space-y-5">
        {/* サムネ + 元動画リンク */}
        {videoId && (
          <a
            href={recipe.sourceUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative rounded-2xl overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={youtubeThumbnailUrl(videoId)} alt="" className="w-full aspect-video object-cover bg-gray-100" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-12 h-12 rounded-full bg-black/55 flex items-center justify-center text-white text-lg pl-1">▶</span>
            </span>
          </a>
        )}

        {/* 栄養（1人前） */}
        <div>
          <p className="text-xs font-bold text-gray-400 mb-2">栄養（1人前あたり）</p>
          <div className="grid grid-cols-4 gap-2">
            <NutrientTile label="kcal" value={recipe.calories != null ? String(recipe.calories) : '—'} cls="bg-orange-50 text-[#FF9800]" />
            <NutrientTile label="P (g)" value={recipe.protein != null ? String(recipe.protein) : '—'} cls="bg-blue-50 text-blue-500" />
            <NutrientTile label="F (g)" value={recipe.fat != null ? String(recipe.fat) : '—'} cls="bg-yellow-50 text-yellow-600" />
            <NutrientTile label="C (g)" value={recipe.carbs != null ? String(recipe.carbs) : '—'} cls="bg-green-50 text-green-600" />
          </div>
          {recipe.servings > 1 && (
            <p className="text-[11px] text-gray-400 mt-1.5">このレシピは {recipe.servings} 人前です</p>
          )}
        </div>

        {/* 材料 */}
        {recipe.ingredients.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2">材料</p>
            <ul className="bg-gray-50 rounded-xl divide-y divide-gray-100">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-baseline justify-between px-3 py-2 text-sm">
                  <span className="text-gray-700 font-medium">{ing.name}</span>
                  {ing.amount && <span className="text-gray-400 text-xs ml-3 flex-shrink-0">{ing.amount}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 手順 */}
        {recipe.steps.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2">作り方</p>
            <ol className="space-y-2">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-[#FF9800] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {recipe.note && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">📝 {recipe.note}</p>
        )}

        {/* アクション */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => onRecord(recipe)}
            className="w-full py-3 bg-[#4CAF50] text-white text-sm font-semibold rounded-xl hover:bg-[#43A047]"
          >
            🍽 食事に記録する
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(recipe)}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
            >
              編集
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 py-2.5 border border-red-100 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-50"
            >
              削除
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function NutrientTile({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className={`rounded-xl px-2 py-2.5 text-center ${cls}`}>
      <p className="text-base font-bold leading-none">{value}</p>
      <p className="text-[10px] font-semibold mt-1 opacity-70">{label}</p>
    </div>
  );
}
