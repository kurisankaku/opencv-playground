# OpenCV 機能分類体系 (Feature Taxonomy)

OpenCV 4.x の機能を、Web アプリ（OpenCV Playground）で扱うための **20 大カテゴリ** に体系化したものです。
カテゴリ ID は `src/data/opencvCategories.ts` の `id` と一致し、各デモ（`src/data/opencvDemos.ts`）はいずれかのカテゴリに属します。

- 凡例（MVP対象）: ◎=中心 / ○=一部含む / △=候補だが後回し / ✕=対象外
- 凡例（難易度）: `beginner` / `intermediate` / `advanced`（カテゴリ内デモの代表値）
- 「OpenCV.js対応」はカテゴリ内デモの傾向。詳細は各デモの `opencvJsSupport` を参照。

---

## カテゴリ一覧（サマリ）

| # | ID | カテゴリ名 | 主モジュール | フェーズ | 優先度 | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `image-basics` | 画像の基本操作 | core, imgproc | phase-1 | S | ◎ |
| 2 | `color-conversion` | 色の変換・色抽出 | imgproc, core | phase-1 | S | ◎ |
| 3 | `filtering-denoising` | フィルタ・ノイズ除去 | imgproc, photo | phase-1 | S | ◎ |
| 4 | `thresholding` | 二値化・しきい値処理 | imgproc | phase-1 | S | ◎ |
| 5 | `morphology` | 形態学的変換 | imgproc | phase-1 | A | ◎ |
| 6 | `edge-gradient` | エッジ・勾配検出 | imgproc | phase-1 | S | ◎ |
| 7 | `contours-shape` | 輪郭・形状検出 | imgproc | phase-2 | S | ○ |
| 8 | `shape-detection` | 直線・円・図形検出 | imgproc | phase-2 | A | ○ |
| 9 | `histogram-analysis` | ヒストグラム・画像解析 | imgproc | phase-3 | A | ○ |
| 10 | `geometric-transform` | 幾何変換・座標変換 | imgproc | phase-3 | A | ○ |
| 11 | `segmentation` | セグメンテーション・領域分割 | imgproc, core | phase-3 | B | △ |
| 12 | `feature-detection` | 特徴点検出・特徴量マッチング | features2d, calib3d | phase-6 | B | ✕ |
| 13 | `object-detection` | 物体検出・顔検出 | objdetect, dnn | phase-5 | A | ✕ |
| 14 | `video-tracking` | 動画解析・トラッキング | video | phase-4 | B | ✕ |
| 15 | `camera-calibration-3d` | カメラキャリブレーション・3D再構成 | calib3d | phase-7 | C | ✕ |
| 16 | `image-restoration-photo` | 画像修復・写真加工 | photo | phase-3 | B | ✕ |
| 17 | `image-stitching` | パノラマ・画像合成 | stitching | phase-6 | C | ✕ |
| 18 | `machine-learning` | 機械学習（古典） | ml, core | phase-7 | C | ✕ |
| 19 | `dnn-deep-learning` | DNN・深層学習推論 | dnn | phase-7 | B | ✕ |
| 20 | `io-ui-browser` | 入出力・UI・ブラウザ連携 | js, core, imgcodecs | phase-1 | S | ◎ |

---

## 1. 画像の基本操作 — `image-basics`

- **説明**: 読み込み・表示・リサイズ・回転・反転・切り抜き・明るさ/コントラスト・チャンネル操作・画像演算など、すべての処理の土台。「画像＝数値の配列」という感覚を最初に与える。
- **対応モジュール**: `core`, `imgproc`
- **主な関数・クラス**: `cvtColor`, `resize`, `warpAffine`, `flip`, `Mat.roi`, `convertTo`, `split`/`merge`, `addWeighted`, `bitwise_*`
- **Webアプリ上での見せ方**: Before/After とスライダ。最も直感的な入口カテゴリ。
- **MVP対象**: ◎（中心）
- **難易度**: beginner
- **注意点**: EXIF の向き情報は OpenCV が扱わないため自前補正が必要。色変換は RGBA 入力前提（canvas 由来）。

## 2. 色の変換・色抽出 — `color-conversion`

- **説明**: RGB / グレースケール / HSV / Lab などの色空間変換と、`inRange` による色領域抽出・マスク生成。色ベースの物体抽出の基礎。
- **対応モジュール**: `imgproc`, `core`
- **主な関数・クラス**: `cvtColor`, `inRange`, `bitwise_and`, `transform`
- **Webアプリ上での見せ方**: HSV カラーピッカーで範囲指定 → 抽出マスクと適用結果をライブ表示。
- **MVP対象**: ◎
- **難易度**: beginner
- **注意点**: OpenCV の Hue は 0–179。赤は H が 0 と 179 にまたがるため 2 範囲の OR が必要。照明変化に弱い。

## 3. フィルタ・ノイズ除去 — `filtering-denoising`

- **説明**: 平均/ガウシアン/メディアン/バイラテラルなどの平滑化、シャープ化、任意カーネルの畳み込み（`filter2D`）、高品質ノイズ除去（`photo`）。
- **対応モジュール**: `imgproc`, （一部 `photo`）
- **主な関数・クラス**: `blur`, `GaussianBlur`, `medianBlur`, `bilateralFilter`, `filter2D`, `fastNlMeansDenoisingColored`
- **Webアプリ上での見せ方**: カーネルサイズ/σ をスライダ操作し、ぼけ具合とエッジ保持の差を並列比較。
- **MVP対象**: ◎
- **難易度**: beginner〜intermediate
- **注意点**: バイラテラルや NL-Means は重い。`photo` モジュールの opencv.js 含有は要調査。

## 4. 二値化・しきい値処理 — `thresholding`

- **説明**: 固定しきい値・大津の自動しきい値・適応的しきい値による 2 値化。前景/背景分離や OCR 前処理の基礎。
- **対応モジュール**: `imgproc`
- **主な関数・クラス**: `threshold`（`THRESH_OTSU` 含む）, `adaptiveThreshold`
- **Webアプリ上での見せ方**: しきい値スライダと手法切替で白黒の境界が動く様子を体感。
- **MVP対象**: ◎
- **難易度**: beginner〜intermediate
- **注意点**: 固定しきい値は照明ムラに弱い。適応的二値化は `blockSize` 奇数制約・パラメータ調整がシビア。

## 5. 形態学的変換 — `morphology`

- **説明**: 収縮・膨張・オープニング・クロージング・トップハット等。2 値画像のノイズ除去・穴埋め・整形。
- **対応モジュール**: `imgproc`
- **主な関数・クラス**: `erode`, `dilate`, `morphologyEx`, `getStructuringElement`
- **Webアプリ上での見せ方**: カーネル形状/サイズ/反復回数を変え、点が消える・穴が埋まる様子を可視化。
- **MVP対象**: ◎
- **難易度**: beginner〜intermediate
- **注意点**: 前景が白である前提。二値化結果との連携が前提。

## 6. エッジ・勾配検出 — `edge-gradient`

- **説明**: Canny・Sobel・Scharr・Laplacian による輪郭線/勾配抽出と画像ピラミッド。形状認識の前段。
- **対応モジュール**: `imgproc`
- **主な関数・クラス**: `Canny`, `Sobel`, `Scharr`, `Laplacian`, `pyrUp`/`pyrDown`
- **Webアプリ上での見せ方**: Canny の 2 しきい値スライダでエッジ量が変わる様子をライブ表示。
- **MVP対象**: ◎
- **難易度**: beginner〜intermediate
- **注意点**: 勾配出力は符号付き → `convertScaleAbs` で可視化。ノイズに敏感なため事前平滑化が望ましい。

## 7. 輪郭・形状検出 — `contours-shape`

- **説明**: 輪郭の抽出・描画と、面積・周囲長・外接矩形・回転矩形・最小外接円・凸包・モーメント等の形状特徴量計算。物体計測・カウントの基礎。
- **対応モジュール**: `imgproc`
- **主な関数・クラス**: `findContours`, `drawContours`, `contourArea`, `arcLength`, `approxPolyDP`, `boundingRect`, `minAreaRect`, `minEnclosingCircle`, `convexHull`, `moments`, `matchShapes`
- **Webアプリ上での見せ方**: 「2値化 → 輪郭検出 → 形状特徴量」をパイプラインで見せ、結果を重畳＋数値テーブル表示。
- **MVP対象**: ○（輪郭検出・描画・面積・外接矩形などは MVP）
- **難易度**: intermediate
- **注意点**: 2 値化品質に強く依存。`MatVector`/`hierarchy` の解放漏れに注意。

## 8. 直線・円・図形検出 — `shape-detection`

- **説明**: Hough 変換による直線・円検出と、テンプレートマッチングによる既知パターン探索。
- **対応モジュール**: `imgproc`
- **主な関数・クラス**: `HoughLinesP`, `HoughLines`, `HoughCircles`, `matchTemplate`, `minMaxLoc`
- **Webアプリ上での見せ方**: 検出された直線/円を入力に重畳。パラメータで検出数が変わる感覚を掴ませる。
- **MVP対象**: ○（Hough 直線・円は MVP、テンプレートマッチングも MVP 候補）
- **難易度**: intermediate
- **注意点**: パラメータに敏感。テンプレートマッチングはスケール/回転に不変でない。

## 9. ヒストグラム・画像解析 — `histogram-analysis`

- **説明**: ヒストグラムの計算・可視化、均一化・CLAHE によるコントラスト改善、ヒストグラム比較・バックプロジェクション。
- **対応モジュール**: `imgproc`
- **主な関数・クラス**: `calcHist`, `equalizeHist`, `CLAHE`/`createCLAHE`, `compareHist`, `calcBackProject`
- **Webアプリ上での見せ方**: 入力画像とヒストグラムグラフを並べ、均一化/CLAHE 前後の分布変化をチャート表示。
- **MVP対象**: ○（ヒストグラム計算・均一化は MVP、CLAHE/比較は発展）
- **難易度**: intermediate
- **注意点**: グラフ描画はアプリ側実装（OpenCV 単体では描画しない）。CLAHE クラスの opencv.js バインディングは要確認。

## 10. 幾何変換・座標変換 — `geometric-transform`

- **説明**: 平行移動・回転・アフィン変換・透視変換（射影変換）・リマップ。座標系の変換全般と書類スキャン風レシピ。
- **対応モジュール**: `imgproc`
- **主な関数・クラス**: `getAffineTransform`, `warpAffine`, `getPerspectiveTransform`, `warpPerspective`, `remap`
- **Webアプリ上での見せ方**: 四隅をドラッグして透視変換し、斜めの書類を正面化する「スキャン」体験。
- **MVP対象**: ○（アフィン・透視変換は MVP、書類スキャンは発展レシピ）
- **難易度**: intermediate〜advanced
- **注意点**: 透視変換の 4 点は平面上の対応が前提。立体物には不向き。

## 11. セグメンテーション・領域分割 — `segmentation`

- **説明**: Watershed・GrabCut・Connected Components・Flood Fill・k-means による画素のグルーピング/領域分割。
- **対応モジュール**: `imgproc`, `core`
- **主な関数・クラス**: `watershed`, `grabCut`, `connectedComponents(WithStats)`, `floodFill`, `kmeans`, `distanceTransform`
- **Webアプリ上での見せ方**: ユーザーが前景/背景をブラシ指定 → 抽出結果を表示する対話型デモが映える。
- **MVP対象**: △（Connected Components などは比較的容易だが MVP からは外す）
- **難易度**: intermediate〜advanced
- **注意点**: GrabCut は重く `opencv.js` 提供が要調査。Watershed はマーカー設計が難しい。

## 12. 特徴点検出・特徴量マッチング — `feature-detection`

- **説明**: コーナー検出（Harris / Shi-Tomasi）、特徴点記述子（ORB / SIFT 等）、特徴量マッチング、ホモグラフィ推定。
- **対応モジュール**: `features2d`, `calib3d`
- **主な関数・クラス**: `cornerHarris`, `goodFeaturesToTrack`, `ORB`, `SIFT`, `BFMatcher`, `drawMatches`, `findHomography`
- **Webアプリ上での見せ方**: 2 枚画像の対応点を線で結ぶ可視化。位置合わせ/物体認識の仕組みを直感化。
- **MVP対象**: ✕
- **難易度**: intermediate〜advanced
- **注意点**: ORB は特許フリーで安定（推奨）。SIFT は opencv.js 含有が要調査。SURF は contrib のため非対応。

## 13. 物体検出・顔検出 — `object-detection`

- **説明**: Haar / LBP カスケードによる顔・目検出、QR コード検出、DNN ベースの物体/顔検出。
- **対応モジュール**: `objdetect`, `dnn`
- **主な関数・クラス**: `CascadeClassifier`, `QRCodeDetector`, `readNet`, `blobFromImage`
- **Webアプリ上での見せ方**: 画像/カメラ映像に検出枠を重畳。モデル/カスケードのロードも学習ポイントに。
- **MVP対象**: ✕
- **難易度**: intermediate〜advanced
- **注意点**: カスケード XML を Emscripten FS にロードする手間。DNN はモデルサイズ・速度が課題。QR は提供有無が要調査。

## 14. 動画解析・トラッキング — `video-tracking`

- **説明**: 背景差分・フレーム差分・オプティカルフロー・Meanshift/Camshift による動き解析と追跡。
- **対応モジュール**: `video`
- **主な関数・クラス**: `BackgroundSubtractorMOG2`, `absdiff`, `calcOpticalFlowPyrLK`, `calcOpticalFlowFarneback`, `meanShift`, `CamShift`
- **Webアプリ上での見せ方**: Web カメラのライブ映像に動きベクトル/追跡枠を重畳（`requestAnimationFrame` ループ）。
- **MVP対象**: ✕（Phase 4 で導入）
- **難易度**: intermediate〜advanced
- **注意点**: カメラは HTTPS 必須。固定カメラ前提の手法が多い。Farneback は重い。

## 15. カメラキャリブレーション・3D再構成 — `camera-calibration-3d`

- **説明**: チェスボードによるカメラキャリブレーション、歪み補正、姿勢推定、ステレオ視差。
- **対応モジュール**: `calib3d`
- **主な関数・クラス**: `findChessboardCorners`, `calibrateCamera`, `undistort`, `solvePnP`
- **Webアプリ上での見せ方**: 複数枚のチェスボード画像から歪みパラメータを推定し補正前後を比較。
- **MVP対象**: ✕
- **難易度**: advanced
- **注意点**: 複数枚必要で UX が重い。`calibrateCamera` の opencv.js 提供・実用性は要調査。専門性が高い。

## 16. 画像修復・写真加工 — `image-restoration-photo`

- **説明**: インペインティング（傷消し）、Non-local Means ノイズ除去、スタイライズ・鉛筆画など計算写真的加工。
- **対応モジュール**: `photo`
- **主な関数・クラス**: `inpaint`, `fastNlMeansDenoising*`, `stylization`, `pencilSketch`, `edgePreservingFilter`, `seamlessClone`
- **Webアプリ上での見せ方**: ブラシでマスクを塗った領域を消す「傷消し」体験。
- **MVP対象**: ✕
- **難易度**: intermediate〜advanced
- **注意点**: `photo` モジュールの opencv.js 含有が要調査。総じて重い処理。

## 17. パノラマ・画像合成 — `image-stitching`

- **説明**: 重なりのある複数画像を特徴点マッチング＋ホモグラフィで繋ぎ 1 枚のパノラマに合成。
- **対応モジュール**: `stitching`（＋ `features2d`, `calib3d`）
- **主な関数・クラス**: `Stitcher`（高レベル API）
- **Webアプリ上での見せ方**: 2〜3 枚をアップロード → 合成結果を表示。
- **MVP対象**: ✕
- **難易度**: advanced
- **注意点**: `Stitcher` は opencv.js デフォルトビルドに含まれない可能性が高い。無い場合は自前実装（特徴量マッチング＋`findHomography`）。

## 18. 機械学習（古典） — `machine-learning`

- **説明**: `ml` モジュールの SVM・kNN・決定木等と、`core` の k-means クラスタリング。DNN 以前の古典的学習。
- **対応モジュール**: `ml`, `core`
- **主な関数・クラス**: `ml.SVM`, `ml.KNearest`, `kmeans`
- **Webアプリ上での見せ方**: 手書き数字認識など小規模デモ。Canvas 描画入力と相性が良い。
- **MVP対象**: ✕
- **難易度**: intermediate〜advanced
- **注意点**: `ml` モジュールの opencv.js 含有が要調査。学習データの同梱が必要。`kmeans` は `core` のため比較的安全。

## 19. DNN・深層学習推論 — `dnn-deep-learning`

- **説明**: `dnn` モジュールで学習済みモデルを読み込み、画像分類・物体検出・セグメンテーション・スタイル変換などを推論。
- **対応モジュール**: `dnn`
- **主な関数・クラス**: `readNet`, `readNetFromONNX`, `blobFromImage`, `Net.forward`, `NMSBoxes`
- **Webアプリ上での見せ方**: モデル読み込み → 推論 → 結果重畳。モデル取得の進捗表示も含めて体験化。
- **MVP対象**: ✕
- **難易度**: advanced
- **注意点**: モデルサイズ（数 MB〜）と推論速度、出力デコードの複雑さ。WASM SIMD/threads の有無で性能差。軽量モデル必須。

## 20. 入出力・UI・ブラウザ連携 — `io-ui-browser`

- **説明**: canvas/Image との相互変換、画像アップロード、Web カメラ取得、Canvas 描画入力、Before/After 比較など、ブラウザ固有の入出力基盤。
- **対応モジュール**: `js`（opencv.js 固有）, `core`, `imgcodecs`
- **主な関数・クラス**: `cv.imread`, `cv.imshow`, `matFromImageData`, `VideoCapture`, `FS_createDataFile`
- **Webアプリ上での見せ方**: デモ機能そのものというより全デモの土台。アップロード/サンプル選択/比較 UI を共通部品化。
- **MVP対象**: ◎（アップロード・サンプル選択・Before/After は MVP の必須基盤）
- **難易度**: beginner
- **注意点**: getUserMedia は HTTPS 必須。EXIF 向き補正が必要。すべての `cv` オブジェクトの `delete()` 規約をここで定義。

---

## 補足: カテゴリ設計の方針

- OpenCV 公式のモジュール構成（core / imgproc / objdetect / video / calib3d / features2d / photo / stitching / ml / dnn）を土台にしつつ、**学習導線**として分かりやすい粒度に再編成した。
- 特に `imgproc` は機能が広いため、用途別に「基本操作 / 色 / フィルタ / 二値化 / 形態学 / エッジ / 輪郭 / 図形検出 / ヒストグラム / 幾何変換 / セグメンテーション」へ分割した。
- ブラウザ固有の入出力（`io-ui-browser`）を独立カテゴリにして、OpenCV 本体機能と UI 基盤を分離した。
- contrib 依存（xfeatures2d / face / tracking(legacy) / ximgproc / bgsegm / aruco）は本体と区別し、原則として対象外（要調査）とする。
