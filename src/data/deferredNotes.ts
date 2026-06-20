/**
 * Verified (2026-06) technical reasons why some catalog demos are NOT yet
 * interactive. These were determined empirically by probing the *shipped*
 * techstark `opencv.js` (4.10) build with `typeof cv.<symbol>` and by the
 * project's procedural-sample constraint — not guessed from documentation.
 *
 * Surfaced on the demo detail page so the "not yet implemented" state is honest
 * about WHY, per research-notes.md §9 ("verify before promising").
 */

export type DeferReason = 'binding-absent' | 'needs-model' | 'needs-real-input' | 'app-feature';

export const deferReasonLabel: Record<DeferReason, string> = {
  'binding-absent': 'opencv.js にバインディング無し',
  'needs-model': '大型モデルファイルが必要',
  'needs-real-input': '実画像入力・アセットの非同期ロードが必要',
  'app-feature': 'アプリ機能（CV処理ではない）',
};

export interface DeferredNote {
  reason: DeferReason;
  detail: string;
}

/** demo id → why it is deferred (verified 2026-06 against the shipped build). */
export const deferredNotes: Record<string, DeferredNote> = {
  // ── opencv.js にバインディングが存在しない（標準ビルド未収録） ──
  'nlmeans-denoising': {
    reason: 'binding-absent',
    detail:
      'cv.fastNlMeansDenoising / fastNlMeansDenoisingColored が未バインド。photo モジュールは inpaint のみ収録され、Non-local Means デノイズは利用できない。代わりに median-blur / bilateral-filter を参照。',
  },
  'chessboard-corners': {
    reason: 'binding-absent',
    detail:
      'cv.findChessboardCorners / drawChessboardCorners / cornerSubPix が未バインド（calib3d のチェスボード検出系が標準ビルドに無い）。',
  },
  'camera-calibration': {
    reason: 'binding-absent',
    detail:
      'cv.calibrateCamera / cornerSubPix が未バインド。前段のチェスボード検出も無いため、校正パイプラインを構成できない。',
  },
  'knn-digit-recognition': {
    reason: 'binding-absent',
    detail:
      'cv.KNearest（ml モジュール）が未バインド。加えて学習データの同梱と手書き入力UIが別途必要。',
  },

  // ── 検出器/分類器は使えるが「実画像入力」と「アセットの非同期ロード」が必要 ──
  'face-detection-haar': {
    reason: 'needs-real-input',
    detail:
      'cv.CascadeClassifier と FS_createDataFile は利用可能。ただし ①カスケードXMLをCDNから worker の Emscripten 仮想FSへ非同期ロードする基盤が必要（impls.run は同期実行）、②手続き生成サンプルに顔が無く、実写真のアップロードが前提になる。',
  },
  'eye-detection-haar': {
    reason: 'needs-real-input',
    detail:
      'face-detection-haar と同条件（haarcascade_eye.xml の仮想FSロード基盤 + 顔/目を含む実画像が必要）。',
  },
  'qr-code-detection': {
    reason: 'needs-real-input',
    detail:
      'cv.QRCodeDetector は利用可能。ただし手続き生成サンプルに有効なQRコードが無く、QR画像のアップロードが前提になる（有効なQRの手続き生成には別途QRエンコーダが要る）。',
  },

  // ── 推論関数はあるが、数MB級のモデルファイル同梱・配信・前後処理が必要 ──
  'dnn-face-detection': {
    reason: 'needs-model',
    detail:
      'cv.readNetFromONNX は利用可能（cv.dnn 名前空間は無いがトップレベル関数で推論できる）。ただし数MB級のONNXモデルの同梱/CORS配信、blobFromImage 前処理、出力デコードの実装が必要。',
  },
  'dnn-image-classification': {
    reason: 'needs-model',
    detail:
      '分類用ONNXモデルの同梱とラベル表・前処理の実装が必要（cv.readNetFromONNX 自体は利用可）。',
  },
  'dnn-object-detection': {
    reason: 'needs-model',
    detail:
      '検出用ONNXモデルの同梱と NMS 後処理の実装が必要（cv.readNetFromONNX 自体は利用可）。',
  },

  // ── OpenCV処理ではなく、既にアプリ側で提供済みの機能 ──
  'image-upload': {
    reason: 'app-feature',
    detail: 'OpenCV処理ではなくアプリ機能。全デモの入力パネルで画像アップロードに対応済み。',
  },
  'before-after-compare': {
    reason: 'app-feature',
    detail: 'OpenCV処理ではなくUI機能。全画像デモのプレビューに Before/After スライダーを実装済み。',
  },
  'canvas-drawing-input': {
    reason: 'app-feature',
    detail:
      'OpenCV処理ではなく入力UI機能。点/矩形のドラッグ入力（SpatialEditor）として flood-fill / inpainting / image-crop 等で実装済み。',
  },
};
