/**
 * 作品の画像を共有または保存する。
 *
 * Web Share API でファイル共有できる端末（多くはスマホ）では共有シートを
 * 開き、できない端末（多くのデスクトップ）ではダウンロードにフォールバック
 * する。共有シートを閉じただけのときは 'canceled' を返し、エラー扱いしない。
 */
export type SaveResult = 'shared' | 'downloaded' | 'canceled';

// lib.dom は canShare / share を必須メソッドとして型付けするが、実際には
// 未対応の環境がある。optional なビューを噛ませて実行時の有無を検査する。
type WebShareNavigator = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export async function saveOrShareImage(
  blob: Blob,
  filename: string,
): Promise<SaveResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav: WebShareNavigator = navigator;

  if (
    typeof nav.canShare === 'function' &&
    typeof nav.share === 'function' &&
    nav.canShare({ files: [file] })
  ) {
    try {
      await nav.share({
        files: [file],
        title: 'fluida',
        text: 'えのぐあそびで描きました',
      });
      return 'shared';
    } catch (error) {
      // 共有シートを閉じただけならキャンセル扱い（エラーにしない）
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'canceled';
      }
      // それ以外の失敗（権限切れなど）はダウンロードにフォールバックする
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
