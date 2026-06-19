# OpenCV 機能カタログ (Feature Catalog)

OpenCV Playground で扱う **91 件**のデモ機能を、カテゴリ別に整理したカタログです。
本ファイルは人間が読むための一覧であり、機械可読な正典は `src/data/opencvDemos.ts`（型は `docs/spec/data-model.md`）です。

## 表の読み方（列 ↔ データモデル対応）

各カテゴリは 2 つの表で構成します（`ID` で対応）。

**表A: 分類・ステータス**

| 列 | 対応フィールド |
| --- | --- |
| ID / 表示名 / 英語名 / サブカテゴリ | `id` / `titleJa` / `titleEn` / `subcategory` |
| 難 | `difficulty`（B=beginner / I=intermediate / A=advanced） |
| 優 | `priority`（S/A/B/C） |
| Ph | `phase`（1〜7） |
| JS対応 | `opencvJsSupport`（✅supported / 🟡likely / 🔍needs-investigation / ⛔not-supported / 🚫not-suitable） |
| MVP | `isMvp`（✔=true） |

**表B: 内容・実装**

| 列 | 対応フィールド |
| --- | --- |
| 説明 | `description` |
| 主な関数 (モジュール) | `opencvFunctions` / `opencvModules` |
| 入力→出力 | `inputTypes` → `outputTypes` |
| 主なパラメータ | `parameters` |
| サンプル画像 | `sampleImages`（詳細は `sample-images.md`） |
| ユースケース | `useCases` |
| 実装メモ / 注意点 | `implementationNotes` / `limitations` |

> JS対応の凡例: ✅=ブラウザ動作の見込みが高い / 🟡=モジュールは含まれる見込みだが最終確認要 / 🔍=要調査 / ⛔=デフォルトビルド非対応見込み / 🚫=ブラウザ向きでない

---

## 1. 画像の基本操作 (`image-basics`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| grayscale-conversion | グレースケール変換 | Grayscale Conversion | color-basics | B | S | 1 | ✅ | ✔ |
| image-resize | リサイズ | Resize | geometry-basics | B | S | 1 | ✅ | ✔ |
| image-rotate | 回転 | Rotate | geometry-basics | B | S | 1 | ✅ | ✔ |
| image-flip | 反転（フリップ） | Flip | geometry-basics | B | S | 1 | ✅ | ✔ |
| image-crop | 切り抜き（ROI） | Crop (ROI) | roi | B | A | 1 | ✅ | ✔ |
| brightness-adjustment | 明るさ調整 | Brightness | pixel-ops | B | A | 1 | ✅ | ✔ |
| contrast-adjustment | コントラスト調整 | Contrast | pixel-ops | B | A | 1 | ✅ | ✔ |
| channel-split-merge | チャンネル分割・合成 | Channel Split/Merge | pixel-ops | B | B | 1 | ✅ | |
| image-arithmetic | 画像の合成（加重加算） | Image Blending | pixel-ops | B | B | 1 | ✅ | |
| bitwise-operations | ビット演算 | Bitwise Operations | pixel-ops | B | B | 1 | ✅ | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| grayscale-conversion | カラーを1ch濃淡へ。全処理の前処理 | cvtColor (imgproc) | image→image | （なし） | portrait, shapes | 前処理標準化, エッジ前段 | RGBA2GRAY を使う / 不可逆 |
| image-resize | 拡大縮小。補間で品質が変わる | resize (imgproc) | image→image | 倍率, 補間方法 | landscape | 高速化縮小, サムネ | 縮小=AREA, 拡大=CUBIC / 極端拡大は劣化 |
| image-rotate | 任意角度回転 | getRotationMatrix2D, warpAffine (imgproc) | image→image | 角度, 拡大率 | portrait, document | 傾き補正, 拡張 | 90°単位は cv.rotate / 四隅が切れる |
| image-flip | 上下/左右/両方反転 | flip (core) | image→image | 反転方向 | portrait | 鏡像, 拡張 | 方向コードの意味を学べる |
| image-crop | 矩形ROIを切り出し | Mat.roi, Rect (core) | image,drawing→image,geometry | 矩形 | shapes, multi-objects | 対象だけ処理 | roiはビュー→clone / 範囲クランプ要 |
| brightness-adjustment | β加算で明るさ変更 | convertTo, add (core) | image→image | 明るさβ | dark | 露出補正 | 飽和クリップ / 白飛び黒つぶれ |
| contrast-adjustment | α倍でコントラスト変更 | convertTo (core) | image→image | コントラストα | low-contrast | 視認性向上 | 線形のみ / CLAHE の方が適応的 |
| channel-split-merge | R/G/Bを分離・再合成 | split, merge (core) | image→image | 表示チャンネル | colored-objects | 色ch理解 | MatVector解放漏れ注意 |
| image-arithmetic | 2枚を加重合成 | addWeighted (core) | multiple-images→image | 画像1の重み | landscape×2 | クロスフェード | 同サイズ・同型必須 |
| bitwise-operations | AND/OR/XOR/NOT | bitwise_and/not (core) | image→image,mask | 演算種別 | shapes, colored-objects | マスク適用, くり抜き | マスクは8UC1 |

---

## 2. 色の変換・色抽出 (`color-conversion`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rgb-hsv-conversion | RGB/HSV変換 | RGB/HSV Conversion | color-space | B | S | 1 | ✅ | ✔ |
| color-extraction-inrange | 色抽出（inRange） | Color Extraction | color-segmentation | B | S | 1 | ✅ | ✔ |
| mask-operation | マスク処理 | Mask Operation | masking | B | A | 1 | ✅ | ✔ |
| color-space-gallery | 各種色空間ギャラリー | Color Space Gallery | color-space | B | B | 1 | ✅ | |
| sepia-tone | セピア調変換 | Sepia Tone | color-effect | B | C | 3 | ✅ | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rgb-hsv-conversion | RGBとHSVの相互変換 | cvtColor (imgproc) | image→image | 表示成分(H/S/V) | colored-objects | 色抽出前段, 彩度調整 | Hは0–179である点を明示 |
| color-extraction-inrange | HSV範囲で特定色を抽出 | inRange, cvtColor (core/imgproc) | image→mask,image | HSV範囲 | colored-objects | 色追跡, 標識判定 | 赤はH 0/179にまたがる→2範囲OR |
| mask-operation | マスクで対象のみ残す/置換 | bitwise_and, copyTo (core) | image→image,mask | モード | colored-objects | 背景置換, 切り出し | 境界はmorphologyで整える |
| color-space-gallery | Lab/YCrCb/HLS等を比較 | cvtColor (imgproc) | image→image | 色空間 | portrait, landscape | 肌色検出, 色差計算 | 値域は色空間ごとに異なる |
| sepia-tone | 色変換行列でセピア化 | transform (core) | image→image | 強度 | portrait | レトロ加工 | 行列で色を作る学習例 |

---

## 3. フィルタ・ノイズ除去 (`filtering-denoising`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| average-blur | 平均ぼかし | Average (Box) Blur | smoothing | B | S | 1 | ✅ | ✔ |
| gaussian-blur | ガウシアンぼかし | Gaussian Blur | smoothing | B | S | 1 | ✅ | ✔ |
| median-blur | メディアンぼかし | Median Blur | smoothing | B | S | 1 | ✅ | ✔ |
| bilateral-filter | バイラテラルフィルタ | Bilateral Filter | edge-preserving | I | A | 1 | ✅ | ✔ |
| sharpen-filter | シャープ化 | Sharpening | convolution | I | A | 1 | ✅ | ✔ |
| custom-kernel-filter2d | カスタムカーネル畳み込み | Custom Kernel | convolution | I | B | 1 | ✅ | |
| nlmeans-denoising | Non-local Means除去 | NL-Means Denoising | denoising | I | B | 3 | 🔍 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| average-blur | 近傍平均で平滑化 | blur (imgproc) | image→image | カーネルサイズ | noisy | 軽いノイズ除去 | ガウシアンと比較提示 |
| gaussian-blur | ガウス重みで平滑化 | GaussianBlur (imgproc) | image→image | ksize, σ | noisy, portrait | ノイズ除去, Canny前段 | ksizeは奇数限定 |
| median-blur | 中央値で置換 | medianBlur (imgproc) | image→image | ksize | noisy | ごま塩ノイズ除去 | ksize大で細部消失 |
| bilateral-filter | エッジ保持の平滑化 | bilateralFilter (imgproc) | image→image | d, 色σ, 距離σ | portrait | 美肌, エッジ保持除去 | 8UC3推奨 / 重い |
| sharpen-filter | カーネル畳み込みで輪郭強調 | filter2D (imgproc) | image→image | 強さ | landscape | ぼやけ補正 | 強すぎるとハロ |
| custom-kernel-filter2d | 3x3カーネルを編集 | filter2D (imgproc) | image→image | カーネル9値 | shapes | 畳み込み理解 | 合計≠1で明るさ変化 |
| nlmeans-denoising | 類似パッチ平均の高品質除去 | fastNlMeansDenoisingColored (photo) | image→image | 強度h | noisy | 高品質ノイズ除去 | photo含有要調査 / 非常に遅い |

---

## 4. 二値化・しきい値処理 (`thresholding`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| simple-threshold | 通常二値化 | Simple Threshold | global-threshold | B | S | 1 | ✅ | ✔ |
| otsu-threshold | 大津の二値化 | Otsu's Threshold | global-threshold | B | A | 1 | ✅ | ✔ |
| adaptive-threshold | 適応的二値化 | Adaptive Threshold | adaptive-threshold | I | A | 1 | ✅ | ✔ |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| simple-threshold | 固定しきい値で白黒分割 | threshold (imgproc) | image→image,mask | しきい値, 種類 | document, shapes | 前景分離, OCR前処理 | 照明ムラに弱い |
| otsu-threshold | 最適しきい値を自動決定 | threshold+OTSU (imgproc) | image→image,mask,numeric | （自動） | document | しきい値自動決定 | 2峰分布が前提 / 値をnumeric表示 |
| adaptive-threshold | 局所的にしきい値を変える | adaptiveThreshold (imgproc) | image→image,mask | blockSize, C, 手法 | document, receipt | 照明ムラ文書の2値化 | blockSize奇数 / 調整シビア |

---

## 5. 形態学的変換 (`morphology`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| erosion | 収縮 | Erosion | basic-morph | B | A | 1 | ✅ | ✔ |
| dilation | 膨張 | Dilation | basic-morph | B | A | 1 | ✅ | ✔ |
| opening | オープニング | Opening | compound-morph | I | A | 1 | ✅ | ✔ |
| closing | クロージング | Closing | compound-morph | I | A | 1 | ✅ | ✔ |
| morphological-gradient | 勾配・トップハット | Gradient/Top-hat | advanced-morph | I | B | 1 | ✅ | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| erosion | 白領域を縮める | erode, getStructuringElement (imgproc) | image→image,mask | ksize, 反復 | noisy-binary, shapes | 白ノイズ除去, 細線化 | 前景=白前提 |
| dilation | 白領域を広げる | dilate (imgproc) | image→image,mask | ksize, 反復 | noisy-binary | 線の接続, 穴埋め | 収縮とペアで提示 |
| opening | 収縮→膨張 | morphologyEx (imgproc) | image→image,mask | ksize | noisy-binary | 点ノイズ除去 | 大ksizeで細部消失 |
| closing | 膨張→収縮 | morphologyEx (imgproc) | image→image,mask | ksize | noisy-binary | 穴埋め, マスク整形 | 近接領域が繋がる |
| morphological-gradient | 膨張−収縮 / トップハット等 | morphologyEx (imgproc) | image→image | 演算, ksize | shapes, document | 輪郭抽出, 背景ムラ補正 | 効果が分かりにくい→説明厚め |

---

## 6. エッジ・勾配検出 (`edge-gradient`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| canny-edge-detection | Cannyエッジ検出 | Canny | edge | B | S | 1 | ✅ | ✔ |
| sobel-derivative | Sobel微分 | Sobel | gradient | I | A | 1 | ✅ | ✔ |
| scharr-derivative | Scharr微分 | Scharr | gradient | I | B | 1 | ✅ | |
| laplacian | Laplacian | Laplacian | gradient | I | A | 1 | ✅ | ✔ |
| image-pyramids | 画像ピラミッド | Image Pyramids | multiscale | I | B | 3 | ✅ | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| canny-edge-detection | 2しきい値のヒステリシスエッジ | Canny (imgproc) | image→image,mask | 下限/上限, Sobel窓 | building, shapes | 輪郭抽出, 線画化 | 前段にGaussianBlur / 比1:2〜1:3 |
| sobel-derivative | x/y方向の勾配 | Sobel (imgproc) | image→image | 方向, ksize | building | 勾配解析 | 符号付き→convertScaleAbs |
| scharr-derivative | 3x3高精度勾配 | Scharr (imgproc) | image→image | 方向 | building | 微細エッジ | Sobel ksize=-1相当 |
| laplacian | 2次微分エッジ | Laplacian (imgproc) | image→image,numeric | ksize | shapes | エッジ強調, ブレ判定 | 分散をnumeric化で応用 |
| image-pyramids | pyrUp/Downで解像度変更 | pyrDown, pyrUp (imgproc) | image→image | 階層, 方向 | landscape | マルチスケール, 合成 | down→upで情報損失を可視化 |

---

## 7. 輪郭・形状検出 (`contours-shape`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| find-contours | 輪郭検出 | Find Contours | contour-extraction | I | S | 2 | ✅ | ✔ |
| draw-contours | 輪郭描画 | Draw Contours | contour-visualization | B | S | 2 | ✅ | ✔ |
| contour-area | 面積計算 | Contour Area | shape-features | B | A | 2 | ✅ | ✔ |
| contour-perimeter | 周囲長計算 | Perimeter (arcLength) | shape-features | B | A | 2 | ✅ | ✔ |
| polygon-approximation | 多角形近似 | Polygon Approximation | shape-features | I | A | 2 | ✅ | ✔ |
| bounding-rect | 外接矩形 | Bounding Rectangle | shape-features | B | A | 2 | ✅ | ✔ |
| rotated-rect | 回転矩形 | Rotated Rectangle | shape-features | I | A | 2 | ✅ | ✔ |
| min-enclosing-circle | 最小外接円 | Min Enclosing Circle | shape-features | B | A | 2 | ✅ | ✔ |
| convex-hull | 凸包 | Convex Hull | shape-features | I | A | 2 | ✅ | ✔ |
| image-moments | モーメント・重心 | Moments / Centroid | shape-features | I | A | 2 | ✅ | ✔ |
| shape-matching | 形状マッチング | Shape Matching | shape-features | I | B | 2 | ✅ | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| find-contours | 2値画像から輪郭点列を抽出 | findContours (imgproc) | image→overlay,numeric | 検出モード, 近似 | shapes, coins | 物体カウント | MatVector/hierarchy解放 / 2値化依存 |
| draw-contours | 輪郭を色付き描画 | drawContours (imgproc) | image→overlay | 線の太さ | shapes | 検出可視化 | findContoursの続き |
| contour-area | 各輪郭の面積 | contourArea (imgproc) | image→numeric,overlay | 最小面積 | coins, multi-objects | サイズ選別 | 画素単位 |
| contour-perimeter | 輪郭の周囲長 | arcLength (imgproc) | image→numeric | 閉曲線 | shapes | 複雑さ評価 | 近似epsilon計算に利用 |
| polygon-approximation | 頂点を削減し形状判定 | approxPolyDP, arcLength (imgproc) | image→overlay,numeric | 近似精度 | shapes, document | 図形分類, 四隅検出 | epsilon=ratio*周囲長 |
| bounding-rect | 軸並行の外接矩形 | boundingRect (imgproc) | image→overlay,geometry | （なし） | multi-objects | 位置表示, クロップ | 回転非対応 |
| rotated-rect | 傾き許容の最小矩形 | minAreaRect, boxPoints (imgproc) | image→overlay,geometry,numeric | （なし） | document | 傾き計測, 角度推定 | 角度定義に注意 |
| min-enclosing-circle | 最小外接円 | minEnclosingCircle (imgproc) | image→overlay,geometry,numeric | （なし） | coins | 円形物体計測 | 2値化依存 |
| convex-hull | 凸包・凹みの解析 | convexHull (imgproc) | image→overlay,geometry | （なし） | shapes, hand | 指検出, 凹凸解析 | convexityDefects対応要確認 |
| image-moments | モーメントから重心 | moments (imgproc) | image→overlay,numeric | （なし） | shapes | 重心追跡, 中心マーク | m00=0のゼロ除算注意 |
| shape-matching | Huモーメントで類似度 | matchShapes (imgproc) | multiple-images→numeric | 比較法 | shapes×2 | 形状分類 | 値小ほど類似 |

---

## 8. 直線・円・図形検出 (`shape-detection`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hough-line-detection | Hough直線検出 | Hough Line | hough | I | A | 2 | ✅ | ✔ |
| hough-circle-detection | Hough円検出 | Hough Circle | hough | I | A | 2 | ✅ | ✔ |
| template-matching | テンプレートマッチング | Template Matching | template | I | A | 2 | ✅ | ✔ |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hough-line-detection | エッジから直線を検出 | HoughLinesP/HoughLines (imgproc) | image→overlay,geometry | しきい値, 最小長, ギャップ | lines, building | レーン/罫線検出 | Canny→HoughLinesP / 曲線不可 |
| hough-circle-detection | 円を検出 | HoughCircles (imgproc) | image→overlay,geometry,numeric | dp, minDist, param1/2 | coins | コイン計数, 瞳検出 | 事前medianBlur / 調整シビア |
| template-matching | 小テンプレを探索 | matchTemplate, minMaxLoc (imgproc/core) | multiple-images→overlay,numeric | 評価法, しきい値 | template-scene+template-patch | 部品位置検出 | 回転/拡大に弱い |

---

## 9. ヒストグラム・画像解析 (`histogram-analysis`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| histogram-calculation | ヒストグラム計算 | Histogram Calculation | histogram | I | A | 3 | ✅ | ✔ |
| histogram-equalization | ヒストグラム均一化 | Histogram Equalization | contrast-enhancement | I | A | 3 | ✅ | ✔ |
| clahe | CLAHE | CLAHE | contrast-enhancement | I | A | 3 | 🟡 | |
| histogram-comparison | ヒストグラム比較 | Histogram Comparison | histogram | I | B | 3 | ✅ | |
| back-projection | バックプロジェクション | Back Projection | histogram | A | C | 3 | 🟡 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| histogram-calculation | 輝度/色の分布をグラフ化 | calcHist (imgproc) | image→chart | チャンネル, ビン数 | portrait, dark | 露出確認, 色傾向分析 | 描画はアプリ側実装 |
| histogram-equalization | 輝度分布を平坦化 | equalizeHist (imgproc) | image→image,chart | （なし） | low-contrast, dark | コントラスト改善 | カラーはYのみに適用 |
| clahe | タイル単位の適応的均一化 | CLAHE, createCLAHE (imgproc) | image→image | クリップ上限, タイル | low-contrast, foggy | 局所コントラスト改善 | クラスのバインディング要確認 |
| histogram-comparison | 2画像の分布類似度 | compareHist, calcHist (imgproc) | multiple-images→numeric,chart | 比較法 | landscape×2 | 簡易画像検索 | 正規化してから比較 |
| back-projection | 対象色の確率マップ化 | calcBackProject (imgproc) | image→mask,image | （なし） | colored-objects | 特定色抽出, Camshift前段 | calcBackProject公開要確認 |

---

## 10. 幾何変換・座標変換 (`geometric-transform`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| affine-transform | アフィン変換 | Affine Transform | affine | I | A | 3 | ✅ | ✔ |
| perspective-transform | 透視変換 | Perspective Transform | perspective | I | A | 3 | ✅ | ✔ |
| document-scanner | 書類スキャン風補正 | Document Scanner | recipe | A | B | 3 | ✅ | |
| image-translation | 平行移動 | Translation | affine | B | B | 3 | ✅ | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| affine-transform | 平行移動/回転/拡大/せん断 | getAffineTransform, warpAffine (imgproc) | image,drawing→image | 変換元/先3点 | shapes, building | 傾き補正, 拡張 | 透視は不可 |
| perspective-transform | 4点対応で遠近補正 | getPerspectiveTransform, warpPerspective (imgproc) | image,drawing→image | 変換元4点 | document, receipt | 書類正面化, 俯瞰変換 | 平面対応が前提 |
| document-scanner | エッジ→四隅→透視→2値の複合 | Canny, findContours, approxPolyDP, warpPerspective (imgproc) | image→image | 四隅自動検出, 白黒化 | document, receipt | 書類/レシートスキャン | 低コントラストで四隅検出失敗 |
| image-translation | x/y平行移動 | warpAffine (imgproc) | image→image | X移動, Y移動 | shapes | 位置合わせ | 行列[[1,0,tx],[0,1,ty]] |

---

## 11. セグメンテーション・領域分割 (`segmentation`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| watershed | Watershed | Watershed | region | A | B | 3 | ✅ | |
| grabcut | GrabCut | GrabCut | foreground | A | B | 3 | 🔍 | |
| connected-components | 連結成分 | Connected Components | labeling | I | A | 2 | ✅ | |
| flood-fill | 塗りつぶし | Flood Fill | region | I | B | 3 | ✅ | |
| kmeans-color-quantization | k-means減色 | k-means Quantization | clustering | I | B | 3 | ✅ | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| watershed | マーカー起点に領域成長 | watershed, distanceTransform, connectedComponents (imgproc) | image→overlay,mask | （なし） | coins | 接触物体の分離 | 手順多→段階表示 / 過分割 |
| grabcut | 矩形/ブラシから前景抽出 | grabCut (imgproc) | image,drawing→mask,image | 前景矩形, 反復 | portrait, colored-objects | 背景除去, 切り抜き | 重い / 提供要調査 |
| connected-components | 連結白領域にラベル | connectedComponents(WithStats) (imgproc) | image→overlay,numeric | 連結数 | multi-objects, coins | 物体カウント, ブロブ解析 | WithStatsで統計取得 |
| flood-fill | クリック点から塗りつぶし | floodFill (imgproc) | image,drawing→image,mask | 開始点, 許容差 | shapes, colored-objects | 領域選択, 色置換 | 許容差シビア |
| kmeans-color-quantization | 色クラスタで減色 | kmeans (core) | image→image | クラスタ数 | colored-objects, landscape | ポスタリゼーション, パレット | reshape/型変換多 / 大画像遅い |

---

## 12. 特徴点検出・特徴量マッチング (`feature-detection`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| harris-corner | Harrisコーナー検出 | Harris Corner | corner | I | B | 6 | ✅ | |
| shi-tomasi-corner | Shi-Tomasiコーナー検出 | Shi-Tomasi | corner | I | B | 6 | ✅ | |
| orb-features | ORB特徴点 | ORB Features | descriptor | I | B | 6 | ✅ | |
| feature-matching | 特徴量マッチング | Feature Matching | matching | A | B | 6 | ✅ | |
| homography-estimation | Homography推定 | Homography | matching | A | C | 6 | ✅ | |
| sift-features | SIFT特徴点 | SIFT Features | descriptor | A | C | 6 | 🔍 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| harris-corner | 勾配からコーナー検出 | cornerHarris (imgproc) | image→overlay | blockSize, k | building, shapes | 特徴点理解 | スケール不変でない |
| shi-tomasi-corner | 追跡向き良質コーナー | goodFeaturesToTrack (imgproc) | image→overlay,geometry | 最大点数, 品質, 距離 | building | LK追跡点選定 | スケール不変でない |
| orb-features | 回転不変な特徴点(特許フリー) | ORB (features2d) | image→overlay | 特徴点数 | matching-pair | 物体認識, 位置合わせ | detectAndCompute |
| feature-matching | 2枚の記述子を対応付け | BFMatcher, ORB, drawMatches (features2d) | multiple-images→overlay | 表示数, クロスチェック | matching-pair | 物体認識, 画像検索 | NORM_HAMMING / 誤対応はRANSACで除去 |
| homography-estimation | 対応点から射影行列推定 | findHomography, warpPerspective (calib3d/imgproc) | multiple-images→image,overlay,geometry | RANSAC閾値 | matching-pair | 位置合わせ, AR貼付 | 良質マッチ必要 / 平面前提 |
| sift-features | スケール不変な高精度特徴点 | SIFT (features2d) | image→overlay | 特徴点数 | matching-pair | 高精度認識 | opencv.js含有要調査 |

---

## 13. 物体検出・顔検出 (`object-detection`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| face-detection-haar | 顔検出（Haar） | Face Detection (Haar) | cascade | I | A | 5 | ✅ | |
| eye-detection-haar | 目検出（Haar） | Eye Detection (Haar) | cascade | I | B | 5 | ✅ | |
| qr-code-detection | QRコード検出 | QR Code Detection | code | I | B | 5 | 🔍 | |
| dnn-face-detection | DNN顔検出 | DNN Face Detection | dnn | A | B | 5 | 🔍 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| face-detection-haar | Haarカスケードで顔矩形検出 | CascadeClassifier (objdetect) | image,camera→overlay,numeric | scaleFactor, minNeighbors | face, multi-objects | モザイク, 顔カウント | XMLをFSにロード / 正面顔に強い |
| eye-detection-haar | 顔内で目を検出 | CascadeClassifier (objdetect) | image,camera→overlay | minNeighbors | face | 視線/まばたき基礎 | 顔ROI内で実行 / 誤検出多 |
| qr-code-detection | QRを検出しデコード | QRCodeDetector (objdetect) | image,camera→overlay,text | （なし） | qr-code | QR読み取り | 提供要調査 / BarcodeDetector代替 |
| dnn-face-detection | DNNで高精度顔検出 | readNet, blobFromImage (dnn) | image,camera→overlay,numeric | 信頼度しきい値 | face, multi-objects | 高精度顔検出 | YuNet軽量 / モデル取得・速度 |

---

## 14. 動画解析・トラッキング (`video-tracking`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| background-subtraction | 背景差分 | Background Subtraction | motion | I | B | 4 | ✅ | |
| frame-differencing | フレーム差分 | Frame Differencing | motion | I | B | 4 | ✅ | |
| optical-flow-lk | Optical Flow (LK) | Optical Flow (LK) | optical-flow | A | B | 4 | ✅ | |
| dense-optical-flow | 密なOptical Flow | Dense Optical Flow | optical-flow | A | C | 4 | 🟡 | |
| meanshift-camshift | Meanshift/Camshift | Meanshift/Camshift | tracking | A | C | 4 | 🟡 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| background-subtraction | 固定カメラで前景抽出 | BackgroundSubtractorMOG2 (video) | video,camera→mask,video | history, varThreshold | webcam, video-traffic | 動体検知, 監視 | 固定カメラ前提 |
| frame-differencing | 連続フレーム差分 | absdiff, threshold (core/imgproc) | video,camera→mask,video | しきい値 | webcam, video-traffic | 簡易動体検知 | 動き停止で消える |
| optical-flow-lk | 特徴点の動きを追跡 | calcOpticalFlowPyrLK, goodFeaturesToTrack (video/imgproc) | video,camera→overlay,video | 追跡点数 | webcam | 動き追跡, ジェスチャ | 追跡点の補充要 |
| dense-optical-flow | 全画素の動きを可視化 | calcOpticalFlowFarneback (video) | video,camera→overlay,video | ピラミッド階層 | video-traffic | 動き場可視化 | 重い / 公開要確認 |
| meanshift-camshift | 色ヒストで領域追跡 | meanShift, CamShift, calcBackProject (video/imgproc) | video,camera→overlay,video | 初期追跡枠 | webcam, colored-objects | 色ベース追跡 | 似色背景に弱い / 公開要確認 |

---

## 15. カメラキャリブレーション・3D再構成 (`camera-calibration-3d`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chessboard-corners | チェスボードコーナー検出 | Chessboard Corners | calibration | A | C | 7 | 🟡 | |
| camera-calibration | キャリブレーション・歪み補正 | Camera Calibration | calibration | A | C | 7 | 🔍 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chessboard-corners | 格子点を検出 | findChessboardCorners, drawChessboardCorners (calib3d) | image→overlay | 格子数 | chessboard | キャリブ前段 | 公開要確認 |
| camera-calibration | 内部パラメータ/歪み推定・補正 | calibrateCamera, undistort (calib3d) | multiple-images→image,numeric | （なし） | chessboard×複数 | レンズ歪み補正 | 複数枚要 / 提供要調査 / 専門的 |

---

## 16. 画像修復・写真加工 (`image-restoration-photo`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| inpainting | インペインティング（傷消し） | Inpainting | restoration | I | B | 3 | 🔍 | |
| stylization-filters | 写真スタイライズ | Stylization Filters | computational-photography | I | C | 3 | 🔍 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| inpainting | マスク領域を周囲から補完 | inpaint (photo) | image,drawing→image | 補完半径, 手法 | damaged-photo | 不要物/傷消し | photo含有要調査 / 大欠損苦手 |
| stylization-filters | 油彩/鉛筆風加工 | stylization, pencilSketch, edgePreservingFilter (photo) | image→image | 効果種別 | portrait, landscape | アート加工 | photo含有要調査 / 重い |

---

## 17. パノラマ・画像合成 (`image-stitching`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| panorama-stitching | パノラマ合成 | Panorama Stitching | stitching | A | C | 6 | 🔍 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| panorama-stitching | 重なり画像を1枚に合成 | Stitcher (stitching) | multiple-images→image | モード | panorama-pair | 風景パノラマ | Stitcher非含有可能性大 / 自前実装は手数大 |

---

## 18. 機械学習（古典） (`machine-learning`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| kmeans-clustering | k-meansクラスタリング | k-means Clustering | clustering | I | C | 7 | ✅ | |
| knn-digit-recognition | kNN手書き数字認識 | kNN Digit Recognition | classification | A | C | 7 | 🔍 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| kmeans-clustering | k個のクラスタに分割 | kmeans (core) | image,sample-only→chart,image | クラスタ数 | colored-objects | 色クラスタ, 代表点 | core提供で安全 / 初期値依存 |
| knn-digit-recognition | kNNで手書き数字分類 | ml.KNearest (ml) | drawing→text,numeric | 近傍数k | （描画入力） | 手書き入力認識 | ml含有要調査 / 学習データ要 |

---

## 19. DNN・深層学習推論 (`dnn-deep-learning`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dnn-image-classification | DNN画像分類 | DNN Image Classification | classification | A | B | 7 | 🔍 | |
| dnn-object-detection | DNN物体検出 | DNN Object Detection | detection | A | B | 7 | 🔍 | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dnn-image-classification | CNNでクラス推論 | readNetFromONNX, blobFromImage (dnn) | image,camera→text,numeric | 上位表示数 | multi-objects, portrait | 物体カテゴリ判定 | MobileNet等軽量 / 正規化値はモデル依存 |
| dnn-object-detection | 複数物体を枠検出 | readNet, blobFromImage (dnn) | image,camera→overlay,numeric | 信頼度, NMS | multi-objects, video-traffic | 多クラス検出 | 軽量モデル必須 / 出力デコード複雑 |

---

## 20. 入出力・UI・ブラウザ連携 (`io-ui-browser`)

### 表A

| ID | 表示名 | 英語名 | サブカテゴリ | 難 | 優 | Ph | JS対応 | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| image-upload | 画像アップロード | Image Upload | input | B | S | 1 | ✅ | ✔ |
| before-after-compare | Before/After比較 | Before/After Comparison | output | B | S | 1 | ✅ | ✔ |
| webcam-capture | Webカメラキャプチャ | Webcam Capture | input | B | A | 4 | ✅ | |
| canvas-drawing-input | Canvas描画入力 | Canvas Drawing Input | input | B | C | 2 | ✅ | |

### 表B

| ID | 説明 | 主な関数 (モジュール) | 入力→出力 | 主なパラメータ | サンプル画像 | ユースケース | 実装メモ / 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| image-upload | ローカル画像をMat化 | imread, matFromImageData (js/imgcodecs) | image→image | （なし） | （ユーザー画像） | 任意画像で試行 | D&D対応, 自動リサイズ / EXIF向き補正要 |
| before-after-compare | 入力と結果を比較表示 | imshow (js) | image→image | 比較モード | （全デモ） | 効果理解 | UI部品 / 全デモで再利用 |
| webcam-capture | カメラ映像をフレーム取得 | VideoCapture (js) | camera→video | （なし） | （ライブ） | ライブ処理入力 | HTTPS必須 / 権限許可 |
| canvas-drawing-input | 描画した線/マスクを入力に | matFromImageData (js) | drawing→mask,image | ブラシ太さ | （描画） | inpaint/GrabCut/手書き | UI基盤 / 連携デモとセット |

---

## サマリ統計

- **総デモ数**: 91 件
- **MVP 対象**: 44 件（`isMvp: true`）
- **OpenCV.js 対応見込み**:
  - ✅ supported: 74 件
  - 🟡 likely-supported: 5 件（clahe, back-projection, dense-optical-flow, meanshift-camshift, chessboard-corners）
  - 🔍 needs-investigation: 12 件（nlmeans-denoising, grabcut, sift-features, qr-code-detection, dnn-face-detection, camera-calibration, inpainting, stylization-filters, panorama-stitching, knn-digit-recognition, dnn-image-classification, dnn-object-detection）
  - ⛔ not-supported / 🚫 not-suitable: 0 件（contrib 専用機能は本カタログでは候補化せず `research-notes.md` で扱う）
- **難易度分布の傾向**: phase-1〜2 は beginner/intermediate 中心、phase-5〜7 は advanced 中心。
