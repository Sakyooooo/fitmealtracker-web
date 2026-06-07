'use client';

/**
 * 画像ファイルを正方形にクロップ＆縮小して data URL を返す。
 * プロフィール画像用（localStorage に収まる軽量サイズ）。
 *
 * @param file   入力画像ファイル
 * @param size   出力の一辺(px)。既定 256
 * @param quality JPEG 品質 0〜1。既定 0.82
 */
export function fileToSquareDataUrl(
  file: File,
  size = 256,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas 2d context not available')); return; }

        // 中央正方形クロップ
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像の読み込みに失敗しました')); };
    img.src = url;
  });
}
