/**
 * 作品の画像を共有または保存する。
 *
 * スマホ・タブレットのように指で操作する端末では共有シートを開き、
 * 「写真に保存」や SNS 送信ができるようにする。マウス主体のデスクトップ
 * では余計なメニューを挟まず、そのままファイルをダウンロードする。
 * 共有シートを閉じただけのときは 'canceled' を返し、エラー扱いしない。
 */
export type SaveResult = 'shared' | 'downloaded' | 'canceled';

// lib.dom は canShare / share を必須メソッドとして型付けするが、実際には
// 未対応の環境がある。optional なビューを噛ませて実行時の有無を検査する。
type WebShareNavigator = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

/**
 * 共有シートを優先すべき端末かどうかを判定する。
 *
 * 主たるポインタが「粗い（指）」端末＝スマホ・タブレットでは、共有シート
 * から写真アプリや SNS に直接わたせて便利。マウスのデスクトップ（Mac/PC）は
 * 共有メニューよりも直接ダウンロードのほうが「画像でのこす」の語感に近い。
 */
function prefersShareSheet(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

export async function saveOrShareImage(
  blob: Blob,
  filename: string,
): Promise<SaveResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  // canShare / share は navigator に束縛が必要なメソッドのため、分割代入せず
  // navigator 越しに呼ぶ（外すと this を失い Illegal invocation で落ちる）。
  const nav: WebShareNavigator = navigator;

  if (
    typeof nav.canShare === 'function' &&
    typeof nav.share === 'function' &&
    nav.canShare({ files: [file] }) &&
    prefersShareSheet()
  ) {
    try {
      // iOS では share() がユーザー操作の有効化（transient activation）を
      // 要求する。呼び出し側は画像生成からこの share() までを最短の await で
      // つなぎ、有効化が切れないようにしている。
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
