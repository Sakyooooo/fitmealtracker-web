'use client';

/**
 * 写真の向きを正規化する（EXIF回転を実ピクセルへ焼き込み、必要なら縮小）。
 *
 * 横向き撮影した写真はEXIFの回転タグだけが付き、ピクセル自体は回転していない
 * ことが多い。<img> タグはEXIFを見て正しい向きで表示するが、
 * /api/analyze-meal はファイルのバイト列をそのままGeminiへ渡しており
 * （src/app/api/analyze-meal/route.ts）、EXIFを解釈しないため、AIには
 * 横倒しの画像として見えて誤判定の原因になる。
 *
 * createImageBitmap({ imageOrientation: 'from-image' }) でEXIF回転を反映した
 * ビットマップを取得し、canvasへ焼き直すことで以後どの経路でも正しい向きの
 * ピクセルデータになる（併せて長辺を上限まで縮小し、アップロード容量も抑える）。
 */
export async function normalizeImagePhoto(
  file: File,
  maxDimension = 2000,
  quality = 0.9,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    let bitmap: ImageBitmap;
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } else {
      return file; // 古い環境: 補正できないので原本のまま(壊すよりはまし)
    }

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;

    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (err) {
    console.warn('[normalizeImagePhoto] 正規化に失敗、元ファイルを使用します:', err);
    return file;
  }
}
