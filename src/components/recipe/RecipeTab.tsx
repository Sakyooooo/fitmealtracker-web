'use client';

import { useState } from 'react';
import { MealCategory, Recipe } from '@/lib/types';
import { extractYouTubeVideoId, youtubeThumbnailUrl } from '@/lib/recipe';
import { useRecipes } from '@/hooks/useRecipes';
import AddRecipeModal from './AddRecipeModal';
import RecipeDetailModal from './RecipeDetailModal';
import RecordRecipesModal from './RecordRecipesModal';

/** useMealData().addMeal と互換の記録関数（date は今日として省略）。 */
export type RecordMealFn = (data: {
  name: string;
  calories: number;
  time: string;
  category: MealCategory;
  protein?: number;
  fat?: number;
  carbs?: number;
}) => Promise<void> | void;

const SOURCE_BADGE: Record<Recipe['sourceType'], { label: string; cls: string }> = {
  youtube: { label: '▶ 動画', cls: 'bg-red-50 text-red-500' },
  text:    { label: '📋 貼付', cls: 'bg-blue-50 text-blue-500' },
  manual:  { label: '✍️ 手入力', cls: 'bg-gray-100 text-gray-500' },
};

export default function RecipeTab({ addMeal }: { addMeal: RecordMealFn }) {
  const { recipes, addRecipe, updateRecipe, deleteRecipe } = useRecipes();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [detail, setDetail] = useState<Recipe | null>(null);
  const [recordFrom, setRecordFrom] = useState<string | null>(null); // 記録モーダルの初期選択レシピid

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400">よく作る料理をストックして、1タップで食事に記録できます</p>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowAdd(true); }}
          className="px-4 py-2 bg-[#FF9800] text-white text-sm font-semibold rounded-xl hover:bg-[#FB8C00] flex-shrink-0 ml-2"
        >
          ＋ 追加
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <p className="text-4xl mb-2">🍳</p>
          <p className="text-sm font-medium">レシピはまだありません</p>
          <p className="text-xs mt-1">YouTube のURLやレシピ文の貼り付けから自動で登録できます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onOpen={() => setDetail(recipe)} />
          ))}
        </div>
      )}

      {/* ── モーダル ── */}
      <AddRecipeModal
        open={showAdd}
        editing={editing}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        onSave={(data) => { addRecipe(data); setShowAdd(false); }}
        onUpdate={(r) => { updateRecipe(r); setShowAdd(false); setEditing(null); }}
      />

      <RecipeDetailModal
        recipe={detail}
        onClose={() => setDetail(null)}
        onEdit={(r) => { setDetail(null); setEditing(r); setShowAdd(true); }}
        onDelete={(id) => { deleteRecipe(id); setDetail(null); }}
        onRecord={(r) => { setDetail(null); setRecordFrom(r.id); }}
      />

      <RecordRecipesModal
        open={recordFrom !== null}
        recipes={recipes}
        initialId={recordFrom}
        onClose={() => setRecordFrom(null)}
        onRecord={async (data) => { await addMeal(data); setRecordFrom(null); }}
      />
    </>
  );
}

function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const videoId = recipe.sourceUrl ? extractYouTubeVideoId(recipe.sourceUrl) : null;
  const badge = SOURCE_BADGE[recipe.sourceType];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full bg-white rounded-2xl shadow-sm p-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
    >
      {/* サムネ */}
      {videoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={youtubeThumbnailUrl(videoId)}
          alt=""
          className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-orange-50 flex items-center justify-center text-2xl flex-shrink-0">
          🍳
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-800 truncate">{recipe.name}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs font-bold text-[#FF9800]">
            {recipe.calories != null ? `${recipe.calories} kcal` : 'kcal 未設定'}
            <span className="text-[10px] font-medium text-gray-400 ml-0.5">/1人前</span>
          </span>
          {recipe.protein != null && <Chip label={`P ${recipe.protein}g`} cls="bg-blue-50 text-blue-500" />}
          {recipe.fat != null && <Chip label={`F ${recipe.fat}g`} cls="bg-yellow-50 text-yellow-600" />}
          {recipe.carbs != null && <Chip label={`C ${recipe.carbs}g`} cls="bg-green-50 text-green-600" />}
        </div>
      </div>

      <span className="text-gray-300 text-lg flex-shrink-0">›</span>
    </button>
  );
}

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}
