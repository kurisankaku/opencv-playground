# 調査メモ (Research Notes)

本ドキュメントは「OpenCV Playground」(ブラウザ上で OpenCV.js / WASM を動かすサーバーレス React+TS SPA、対象は OpenCV 4.x) の開発にあたり、**OpenCV 本体 (ネイティブ) でできること**と**OpenCV.js (公式 WASM ビルド) でブラウザ上で実際に動かせること**を切り分けるための調査・検証メモである。

> [!IMPORTANT]
> このメモの最大の目的は「正直に不確実性を残すこと」である。
> 公式ビルドにモジュールが含まれていても、**個々の関数・クラスがバインディングとして実際に公開されているか**はビルド・バージョンに依存する。
> 「確実に動く」と言い切れないものは積極的に **要調査** と明記する。
> ここに書いた可用性・サイズ・速度の数値はいずれも**目安**であり、最終的な判断は **実際に ship する `opencv.js` に対して検証**したうえで行うこと。

---

## 1. 参照したOpenCV公式ドキュメント

実際の URL・バージョンは `docs.opencv.org` 上で **ship する OpenCV 4.x のバージョンに合わせて確認**すること。以下は参照すべきドキュメント領域の一覧であり、URL は仕様に都合よく記憶で書かず、必ず公式で実体を確認する。

| ドキュメント領域 | 内容 | 備考 |
| --- | --- | --- |
| OpenCV.js Tutorials | ブラウザでの読み込み、`cv.Mat` の扱い、画像 I/O、各種チュートリアル | OpenCV.js 固有の作法はここが一次情報 |
| core module reference | `Mat` / `MatVector` / `Scalar` / 基本演算 / `kmeans` 等 | バインディングの有無は要確認 |
| imgproc module reference | フィルタ / 幾何変換 / 輪郭 / ヒストグラム等 | ブラウザでよく使う中心モジュール |
| objdetect module reference | `CascadeClassifier` / `QRCodeDetector` | XML の VFS ロードが必要 |
| video module reference | 背景差分 / オプティカルフロー / mean/CamShift | per-API バインディングは要確認 |
| dnn module reference | `readNet*` / `blobFromImage` / `forward` | モデルファイルと前処理が前提 |
| features2d module reference | `ORB` / `SIFT` / 特徴マッチング | SIFT のビルド有無は要確認 |
| calib3d module reference | `findHomography` / `calibrateCamera` / `solvePnP` | 実用性はブラウザで要検証 |
| photo module reference | `inpaint` / デノイズ / 非写実フィルタ | デフォルトビルド収録が不確実 |
| stitching module reference | `Stitcher` | デフォルト未収録の可能性大 |
| ml module reference | `SVM` / `KNearest` 等 | 収録不確実 |
| `opencv_js.config.py` (リポジトリ) | WASM ビルドの module white-list 定義 | 何が公開されるかの根拠ファイル |

> 注: ドキュメントのバージョンセレクタは「現在の安定版」を指していることが多い。**ship する版**(例: 4.8 系 / 4.9 系 / 4.10 系のいずれか)と齟齬がないか必ず突き合わせる。

---

## 2. OpenCV.jsで利用可能な機能（確度高め）

以下は OpenCV.js でブラウザ実行が**実績として固い**グループ。とはいえ最終的には ship する `opencv.js` に対して `typeof cv.xxx` で存在確認することを推奨する。

| 機能群 | 代表関数 | 確度コメント |
| --- | --- | --- |
| 色変換 | `cvtColor`, `inRange`, `split`, `merge` | 確度高。RGBA/RGB/GRAY のチャンネル整合に注意 |
| リサイズ・幾何変換 | `resize`, `warpAffine`, `warpPerspective`, `getPerspectiveTransform` | 確度高。基礎機能として安定 |
| 二値化 | `threshold`, `adaptiveThreshold` | 確度高 |
| 平滑化フィルタ | `GaussianBlur`, `medianBlur`, `blur`, `bilateralFilter`, `filter2D` | 確度高。カーネルサイズの奇数制約あり |
| モルフォロジー | `erode`, `dilate`, `morphologyEx` | 確度高 |
| エッジ・微分 | `Canny`, `Sobel`, `Scharr`, `Laplacian` | 確度高 |
| 輪郭 | `findContours`, `drawContours`, `contourArea`, `arcLength`, `approxPolyDP`, `boundingRect`, `minAreaRect`, `minEnclosingCircle`, `convexHull`, `moments` | 確度高。`MatVector` の `.delete()` 必須 |
| ハフ変換 | `HoughLines`, `HoughLinesP`, `HoughCircles` | 確度高 |
| テンプレートマッチング | `matchTemplate` | 確度高 |
| ヒストグラム | `calcHist`, `equalizeHist`, `compareHist` | 確度高。`calcHist` は引数の Vector 化に注意 |
| 連結成分・領域 | `connectedComponents`, `floodFill`, `watershed` | 確度高 |
| クラスタリング | `kmeans` (core) | 確度高 |
| ビット・合成演算 | `bitwise_and/or/xor/not`, `addWeighted` | 確度高 |
| 画像ピラミッド | `pyrUp`, `pyrDown` | 確度高 |
| 物体検出 (Haar/LBP) | `CascadeClassifier` | 動作実績あり。ただしカスケード XML を Emscripten 仮想 FS にロードする必要あり (後述) |

### CascadeClassifier の補足

`CascadeClassifier` は動くが、学習済みカスケード XML を **Emscripten の仮想ファイルシステム (MEMFS)** に置いてからパスで読み込む必要がある。典型的には:

1. XML を `fetch` で取得
2. `cv.FS_createDataFile(...)` もしくは `utils.createFileFromUrl(...)` で VFS に書き込み
3. `new cv.CascadeClassifier()` → `.load(path)`

XML のホスティング (同一オリジン or CORS 許可) と読み込み完了の待機を実装側で確実に扱うこと。

---

## 3. OpenCV本体にはあるがOpenCV.jsでは要調査の機能

「ネイティブにはあるがブラウザビルドで公開されているか不確実」なもの。**約束する前に必ず実体検証**する。

| 機能 | モジュール | 要調査の理由 |
| --- | --- | --- |
| `QRCodeDetector` | objdetect | バインディング公開が版依存。検出/デコードの両方が動くか要確認 |
| `CLAHE` (適応的ヒストグラム平坦化) | imgproc | クラスとしてのバインディング公開が不確実。`createCLAHE` 経由で使えるか要確認 |
| 背景差分 `BackgroundSubtractorMOG2` / `KNN` | video | モジュールは含まれる想定だが per-API のバインディングは要確認 |
| `calcOpticalFlowPyrLK` | video | likely-supported。実際の引数形と動作は要確認 |
| `calcOpticalFlowFarneback` | video | バインディング公開が要確認 |
| `meanShift` / `CamShift` | video | バインディング公開が要確認 |
| `SIFT` | features2d | 4.4+ で main へ移動。ただし `opencv.js` にコンパイルされているかは要確認 |
| `findHomography` | calib3d | 概ね使える想定。実体確認推奨 |
| `calibrateCamera` / `findChessboardCorners` / `solvePnP` | calib3d | likely-supported〜要調査。ブラウザでの実用性 (精度/速度) も別途検証 |
| `photo` 系 (`inpaint`, `fastNlMeansDenoising`, `stylization`, `pencilSketch`, `edgePreservingFilter`, `seamlessClone`) | photo | デフォルトビルドへの収録自体が不確実 |
| `Stitcher` | stitching | デフォルト未収録の可能性が高い。カスタムビルド or 自前実装が必要かも |
| `ml` 系 (`SVM`, `KNearest` 等) | ml | 収録不確実 |

> 「likely-supported」は楽観的予測であり保証ではない。`typeof cv.X === 'function'` / `typeof cv.X === 'undefined'` で存在を確認し、ダメなら 5・6・7 章の手段に切り替える。

---

## 4. ブラウザ実装に向かない機能 (not-suitable-for-browser)

技術的に動かせても、ブラウザ SPA では避ける/慎重に扱うべきもの。

| 機能カテゴリ | 例 | 向かない理由 |
| --- | --- | --- |
| ネイティブ I/O | `imread` / `imwrite` (ファイルパス), `VideoCapture` (ファイル/RTSP) | OS のファイルシステムやカメラデバイスに直接アクセス不可。入力は `<canvas>`/`ImageData`/`getUserMedia`、出力は canvas/Blob 経由にする |
| GUI / HighGUI | `imshow` (ウィンドウ), `namedWindow`, `waitKey`, `createTrackbar`, `setMouseCallback` | デスクトップ GUI 前提。ブラウザでは canvas + DOM で代替 |
| 重量級の最適化処理 | `Stitcher` フルパイプライン, 大規模 `calibrateCamera`, 高解像度の `fastNlMeansDenoising` | WASM 単スレッドだと数秒〜数十秒かかりメインスレッドを固める。最低でも Web Worker、できれば縮小入力で |
| 大規模 DNN 推論 | 物体検出/セグメンテーションの大型モデル | モデルが数十 MB、推論が遅い。SIMD/threads 無しだと体感が厳しい (5章参照) |
| マルチスレッド前提処理 | TBB/OpenMP 並列に依存する処理 | WASM threads は `SharedArrayBuffer` + COOP/COEP ヘッダが必要で、ホスティング制約に直結 (要調査) |
| 長時間のリアルタイム動画解析 | フレーム毎の重い処理 | UI スレッドブロック・発熱・電池消費。Worker + 間引き + 解像度ダウンが前提 |

設計指針: 重い処理は **Web Worker** に逃がし、UI スレッドをブロックしない。入力解像度は処理前に積極的にダウンスケールする。

---

## 5. モデルファイルが必要な機能 (DNN系, 一部objdetect)

`dnn` モジュール自体は含まれており、`readNet` / `readNetFromONNX` / `blobFromImage` / `forward` で推論は可能。ただしブラウザ運用には固有の懸念がある。

| 懸念 | 内容 | 対策方針 |
| --- | --- | --- |
| モデルサイズ | 軽量モデルでも数 MB、一般的な検出/セグメンテーションは概ね数十 MB に及ぶこともある | 初回ロードを遅延化。CDN/キャッシュ活用。サイズ表記は実測してから提示する |
| 取得 (ホスティング/CORS) | モデルは別ファイルとして fetch する必要。クロスオリジンだと CORS 設定が要る | 同一オリジン配信 or CORS 許可済み CDN。失敗時のフォールバック UI |
| 前処理 | `blobFromImage` のスケール・mean 減算・swapRB・入力サイズはモデル毎に異なる | モデルごとに前処理パラメータを定義・テスト |
| 出力デコード | 出力テンソルの形状・後処理 (NMS 等) がモデル依存 | モデル毎にデコーダを実装。サンプル出力で検証 |
| 推論速度 | WASM 単スレッド・SIMD 無しだと遅い。SIMD/threads (SharedArrayBuffer, COOP/COEP) で大きく変わる | デプロイ毎に **要調査**。SIMD ビルド/threads 可否を計測してから機能を約束する |

**軽量モデルの方針**: まずは入力解像度を小さく取れる軽量モデル (小型分類器・軽量検出器など) から始め、入力をダウンスケールして推論。重いモデルは「実験的」扱いにし、計測値が出てから本採用する。`CascadeClassifier` の XML も「モデルファイルが必要な機能」と同様に VFS への配置・配信を要する点に注意 (2章参照)。

---

## 6. OpenCV contribに依存する可能性がある機能

contrib (`opencv_contrib`) のモジュールは**標準の OpenCV.js ビルドには含まれない**。使うにはカスタム Emscripten ビルドが必要 → 原則 not-supported / 要調査。

| 機能 | 由来モジュール | 状況 |
| --- | --- | --- |
| `SURF` | xfeatures2d (contrib) | 標準ビルド未収録。特許も絡む。ORB で代替するのが基本 |
| 顔認識 (`LBPHFaceRecognizer` 等) | face (contrib) | 標準未収録。カスタムビルド or DNN ベースで代替検討 |
| レガシー tracking (`TrackerKCF`, `TrackerCSRT` 等の legacy 名前空間) | tracking (contrib) | 標準未収録。要調査/自前実装 |
| ArUco マーカー | aruco (contrib。版により main へ移動) | 標準ビルドでの公開は不確実。要調査 |
| 拡張 imgproc | ximgproc (contrib) | 標準未収録 |
| 背景差分の拡張 | bgsegm (contrib) | 標準未収録 (`video` の MOG2/KNN とは別) |

> SIFT は OpenCV 4.4+ で **main の features2d** へ移っており contrib 依存ではない。ただし「`opencv.js` にコンパイル済みか」は別問題で 3 章のとおり要調査。

contrib 機能が必要なら: (a) `opencv_contrib` を含めた**カスタム Emscripten ビルド**、(b) 別の JS ライブラリで代替、(c) 当該機能を非対応とする、のいずれか。

---

## 7. ビルド構成に関する注意

- OpenCV.js は `opencv_js.config.py` の **module white-list** に基づいて生成される。よく含まれるのは core / imgproc / objdetect / video / dnn / features2d / photo / calib3d 等だが、**具体的にどの関数・クラスが公開されるかはビルドとバージョン依存**。
- したがって「モジュールが含まれる ≠ 目的の関数が使える」。per-function の可用性は **実体の `opencv.js` に対して検証**する。
- 標準ビルドで足りない場合の選択肢:
  - **自前ビルド (custom Emscripten build)**: white-list を編集して必要モジュール (contrib 含む) を追加。ビルド環境・CI・配信サイズ管理のコストが増える。
  - **SIMD ビルド**: WASM SIMD 対応ビルドで高速化が見込めるが、対応有無・効果は **要調査**。
  - **threads ビルド**: `SharedArrayBuffer` を使うため **COOP/COEP ヘッダ** (`Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Embedder-Policy: require-corp`) が必要。サーバーレス/CDN 配信でヘッダを付与できるかは **要調査** (静的ホスティングの制約に直結)。
- ファイルサイズ: 標準ビルドの `opencv.js` (wasm 込み) は**概ね数 MB〜10MB 程度**になりがち。正確な値は ship するビルドで実測する。モジュールを増やすほど肥大化する点に留意。
- 読み込み: `opencv.js` は非同期初期化 (`cv['onRuntimeInitialized']` / Module の Promise) を待ってから API を呼ぶ。初期化前アクセスはクラッシュ要因。

---

## 8. メモリ管理・実装上の落とし穴

Emscripten のヒープは**手動管理**。JS の GC では `cv.Mat` 等は解放されない。

| 落とし穴 | 内容 | 対策 |
| --- | --- | --- |
| `Mat.delete()` 忘れ | 生成した `cv.Mat` を解放しないとヒープリーク → 連続処理でクラッシュ | 生成した Mat は必ず `.delete()`。`try/finally` でまとめて解放するヘルパを用意 |
| `MatVector` / `RectVector` / `PointVector` 等 | これらも手動解放対象。要素 Mat を取り出した場合はそれも管理 | Vector 自体と、取り出した Mat の両方を `.delete()` |
| 型/チャンネル不一致 | canvas からは RGBA (CV_8UC4)。多くの処理は RGB/GRAY を想定 | 処理前に `cvtColor` で RGBA→RGB / RGBA→GRAY 変換。出力時は逆変換 |
| 深度・型ミスマッチ | `CV_8U` と `CV_32F` の取り違えで黒画像/例外 | 演算前に `convertTo` で型を揃える。`filter2D` 等の深度引数に注意 |
| HSV の H スケール | OpenCV の Hue は **0〜179** (0〜360 でも 0〜255 でもない) | `inRange` の閾値は 0〜179 前提で設計。色相環の wrap (赤の境界) に注意 |
| EXIF 向き | OpenCV は EXIF orientation を扱わない | アプリ側で向きを補正してから処理 (例: `createImageBitmap({imageOrientation:'from-image'})` 等を検討) |
| 奇数カーネルサイズ制約 | `GaussianBlur` / `medianBlur` 等はカーネルが**正の奇数**である必要 | UI でスライダ値を奇数に丸める (`k|1` 等) |
| ROI と元 Mat の共有 | ROI (部分行列) は元データを参照。元を delete すると ROI も無効 | 寿命関係を意識。必要なら `.clone()` |
| 非同期初期化との競合 | 初期化完了前に API 呼び出し | `onRuntimeInitialized` 後にのみ処理を実行 |
| Worker 間転送 | Mat はそのまま postMessage できない | `ImageData` / transferable な `ArrayBuffer` に変換して受け渡し |

---

## 9. 実装前に追加調査が必要な項目

機能を UI/仕様で「できる」と約束する前に、**実際に ship する `opencv.js` に対して**下記を確認する。各項目は存在確認 (`typeof cv.X`) + 最小サンプルでの動作確認をもって完了とする。

### 9.1 バインディング存在/動作確認

- [ ] `CLAHE` (`cv.CLAHE` クラス or `cv.createCLAHE`) が公開されているか
- [ ] `QRCodeDetector` の検出 + デコードが動くか
- [ ] `photo` モジュール (`inpaint`, `fastNlMeansDenoising`, `stylization`, `pencilSketch`, `edgePreservingFilter`, `seamlessClone`) の各 API が存在するか
- [ ] `Stitcher` が存在するか (無ければ features2d + `findHomography` で自前実装する方針か決定)
- [ ] `SIFT` (`cv.SIFT`) がコンパイルされているか (無ければ `ORB` を既定に)
- [ ] `ml` 系 (`cv.SVM`, `cv.KNearest` 等) が公開されているか
- [ ] `calibrateCamera` / `findChessboardCorners` / `solvePnP` の存在とブラウザでの実用性 (精度/速度)
- [ ] `calcOpticalFlowFarneback` のバインディング有無
- [ ] `meanShift` / `CamShift` のバインディング有無
- [ ] 背景差分 `BackgroundSubtractorMOG2` / `KNN` の生成・apply 動作
- [ ] `calcOpticalFlowPyrLK` の引数形と動作
- [ ] `findHomography` の動作 (RANSAC 含む)

### 9.2 ランタイム/ビルド/性能

- [ ] ship する `opencv.js` の **正確なバージョンとファイルサイズ**を実測
- [ ] WASM **SIMD** ビルドが使えるか、効果はどの程度か計測
- [ ] WASM **threads** が使えるか (= **COOP/COEP ヘッダ**をホスティングで付与できるか)
- [ ] `SharedArrayBuffer` がデプロイ環境で有効になるか
- [ ] DNN 推論の実測速度 (代表モデルでベンチ。Worker 有無・解像度別)

### 9.3 モデル/アセット配信

- [ ] DNN モデルの **取得 (CORS/同一オリジン)** とキャッシュ戦略
- [ ] DNN モデル毎の **前処理パラメータ** (scale/mean/swapRB/size) と出力デコード
- [ ] `CascadeClassifier` XML の VFS ロード手順と配信先の確定
- [ ] 各アセット (opencv.js / wasm / モデル / XML) のロード失敗時のフォールバック UI

---

## 10. 代替ライブラリ・回避策

OpenCV.js で不足/不確実な領域は、以下の代替・回避策を検討する。

| 課題領域 | 回避策・代替 | メモ |
| --- | --- | --- |
| QR コード読み取り | ブラウザ標準 **`BarcodeDetector` API** | 対応ブラウザ・フォーマットが限定的。要 feature detection。非対応時は別手段にフォールバック |
| QR コード読み取り (汎用) | **jsQR** (純 JS) | OpenCV.js の `QRCodeDetector` が未公開/不安定なときの軽量代替 |
| バーコード全般 | **ZXing (zxing-js)** | 多フォーマット対応。OpenCV に依存せず実装可能 |
| contrib 機能が必要 | **カスタム Emscripten ビルド** | white-list を編集して contrib を同梱。ビルド/配信コスト増 |
| 重い処理・大型モデル | **サーバーサイド処理** | 本プロジェクトは**サーバーレス SPA**が前提のため**原則 non-goal**。採用時はアーキテクチャ前提を再検討 |
| 顔検出/汎用検出 | 用途次第で **MediaPipe / TensorFlow.js** | OpenCV.js DNN より導入が容易な場合がある。依存とサイズはトレードオフ |
| 軽量な画像処理のみ | Canvas 2D / 自前 WASM / `glfx` 等 | OpenCV.js を読み込むほどでもない軽処理は標準 API で済ませる選択肢 |
| デノイズ/非写実 (`photo` 未収録時) | 自前フィルタ実装 or カスタムビルド | `photo` がビルド未収録なら imgproc の組合せ or 自前で近似 |

> 方針: まず **OpenCV.js 標準ビルドで動くもの (2章)** を基盤に MVP を組み、要調査領域 (3・5・6章) は 9章のチェックリストで**検証が取れてから**段階的に解放する。サーバーサイド依存は本プロジェクトのサーバーレス前提に反するため、安易に逃げ道にしない。

---

_最終更新は実装着手時の検証結果を反映すること。本メモの「要調査」項目が 9 章のチェックで埋まり次第、確度を更新する。_
