import { RecipeAnalysisResult } from './recipe';

export type RecipeAnalysisResponse =
  | { ok: true; result: RecipeAnalysisResult }
  | { ok: false; error: string };

async function callAnalyzeRecipe(body: Record<string, string>): Promise<RecipeAnalysisResponse> {
  try {
    const res = await fetch('/api/analyze-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (data as { error?: string } | null)?.error ??
        (res.status === 429
          ? '回数制限に達しました。1分ほど待って再度お試しください。'
          : 'AI解析に失敗しました。');
      return { ok: false, error: message };
    }
    return { ok: true, result: data as RecipeAnalysisResult };
  } catch (e) {
    console.error('[recipeAnalysis]', e);
    return { ok: false, error: '通信に失敗しました。' };
  }
}

/** YouTube 動画をAIが解析してレシピを抽出する（公開動画のみ・数十秒かかることあり）。 */
export function analyzeRecipeByYoutube(url: string): Promise<RecipeAnalysisResponse> {
  return callAnalyzeRecipe({ youtubeUrl: url });
}

/** レシピ文・概要欄テキストからレシピを構造化抽出する。 */
export function analyzeRecipeByText(text: string): Promise<RecipeAnalysisResponse> {
  return callAnalyzeRecipe({ text });
}
