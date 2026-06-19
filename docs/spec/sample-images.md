# サンプル画像要件 (Sample Images)

各デモで「画像を持っていないユーザーでも即座に体験できる」ようにするためのサンプル画像セットを定義します。
ここで定義する `id` は `src/data/opencvDemos.ts` の `sampleImages[].id`（および `opencv-feature-catalog.md` の「サンプル画像」列）と対応します。

## 方針

- **MVP では「MVP 必須」マークの画像のみ**を用意すれば成立する（最小セット）。
- 画像は `public/samples/<id>.jpg`（または `.png`）に配置し、長辺は概ね **1280px 程度**に事前リサイズ（メモリ・転送量配慮、`non-functional-requirements.md` 参照）。
- **ライセンスは厳守**: 自作画像、CC0 / パブリックドメイン、または OpenCV 公式サンプル（BSD/Apache 系）に限定する。人物・顔画像は肖像権・モデルリリースに留意し、可能なら合成/許諾済み画像を使う。出典は `licenses` ページに明記。
- 1 枚で複数デモに使い回せるものを優先し、点数を最小化する。

> ライセンス・出典の確定は **実装前の要確認事項**（`research-notes.md` の調査項目に含む）。

---

## サンプル画像カタログ

凡例: MVP = MVP デモで必要 / 入力種別は基本 `image`（特記あるもののみ別記）。

| id | 種別 | 内容・要件 | 主に使うデモ | MVP |
| --- | --- | --- | --- | --- |
| `portrait` | 人物写真 | 人物が中心の自然な写真。肌・髪・背景があり、平滑化/色空間/重心等に好適 | grayscale-conversion, image-rotate, image-flip, bilateral-filter, sepia-tone, color-space-gallery, histogram-calculation, grabcut, stylization-filters | ✔ |
| `face` | 顔写真 | 正面顔が明確に写る（できれば複数人）。顔/目検出用 | face-detection-haar, eye-detection-haar, dnn-face-detection | |
| `landscape` | 風景写真 | 空・地平線・自然物。色分布が豊かで、リサイズ/合成/ヒスト比較に好適 | image-resize, image-arithmetic, image-pyramids, sharpen-filter, histogram-comparison, kmeans-color-quantization | ✔ |
| `building` | 建物写真 | 直線エッジが豊富な建築物。エッジ/勾配/コーナー/直線検出に好適 | canny-edge-detection, sobel-derivative, scharr-derivative, hough-line-detection, harris-corner, shi-tomasi-corner, affine-transform | ✔ |
| `document` | 書類写真 | 斜めから撮った文字書類。二値化/透視変換/スキャンに必須 | simple-threshold, otsu-threshold, adaptive-threshold, perspective-transform, document-scanner, rotated-rect, polygon-approximation | ✔ |
| `receipt` | レシート写真 | 細長い・低コントラスト・しわのあるレシート。適応的二値化/スキャンの実例 | adaptive-threshold, perspective-transform, document-scanner | |
| `shapes` | 図形画像 | 白背景に三角/四角/丸など単純図形。輪郭・形状特徴量の教材に最適 | find-contours, draw-contours, contour-area, contour-perimeter, polygon-approximation, bounding-rect, min-enclosing-circle, convex-hull, image-moments, shape-matching, flood-fill | ✔ |
| `coins` | 円が含まれる画像 | 複数のコイン（重なり少なめ）。Hough円/最小外接円/Watershed に最適 | hough-circle-detection, min-enclosing-circle, contour-area, connected-components, watershed | ✔ |
| `lines` | 直線が多い画像 | 道路・格子・罫線など直線主体。Hough直線検出の教材 | hough-line-detection | ✔ |
| `colored-objects` | 色付きの物体画像 | 鮮やかな単色物体が複数（赤/緑/青など）。色抽出/マスクに必須 | color-extraction-inrange, mask-operation, rgb-hsv-conversion, bitwise-operations, channel-split-merge, back-projection, kmeans-color-quantization, meanshift-camshift, grabcut | ✔ |
| `noisy` | ノイズ入り画像 | ごま塩/ガウスノイズを付与した画像。ノイズ除去フィルタの効果実証に必須 | median-blur, gaussian-blur, average-blur, nlmeans-denoising | ✔ |
| `noisy-binary` | ノイズ入り2値画像 | 白背景に黒物体＋点ノイズ＋小穴。形態学の効果が明確に出る | erosion, dilation, opening, closing, morphological-gradient | ✔ |
| `dark` | 暗い画像 | 露出不足の暗い写真。明るさ調整/ヒスト均一化の対象 | brightness-adjustment, histogram-equalization, histogram-calculation | ✔ |
| `low-contrast` | 低コントラスト画像 | 明暗差の乏しい霞んだ画像。コントラスト改善/CLAHE の対象 | contrast-adjustment, histogram-equalization, clahe | ✔ |
| `foggy` | 霧・逆光画像 | 局所的に白んだ画像。CLAHE の局所補正が映える | clahe | |
| `multi-objects` | 複数物体が写る画像 | 複数の物体が散在。カウント/外接矩形/連結成分/検出に好適 | bounding-rect, connected-components, contour-area, image-crop, face-detection-haar, dnn-object-detection, dnn-image-classification | ✔ |
| `hand` | 手の画像 | 開いた手のひら。凸包・凸性欠陥（指検出）の教材 | convex-hull | |
| `template-scene` | テンプレ探索の全体画像 | 小物が複数配置された画像。テンプレートマッチングの探索対象 | template-matching | ✔ |
| `template-patch` | テンプレ小片 | `template-scene` 内の一部を切り出した小画像。マッチング対象 | template-matching | ✔ |
| `matching-pair` | 特徴点マッチング用2枚 | 同一物体を視点/スケール違いで撮った 2 枚（入力 `multiple-images`） | orb-features, feature-matching, homography-estimation, sift-features | |
| `panorama-pair` | パノラマ用の重なり画像 | 30〜50% 重なる横並び 2〜3 枚（入力 `multiple-images`） | panorama-stitching | |
| `chessboard` | チェスボード画像 | キャリブレーション用市松模様（複数枚）。歪みのある実写が望ましい | chessboard-corners, camera-calibration | |
| `qr-code` | QRコード画像 | QR を含む写真（傾き/距離違い）。検出・デコード用 | qr-code-detection | |
| `damaged-photo` | 傷あり写真 | 線傷・しみ・文字が乗った写真。インペインティングの対象（マスクは描画入力） | inpainting | |
| `video-traffic` | 動画（固定カメラ） | 人/車が通る固定カメラ映像（入力 `video`）。動体検知/フロー用 | background-subtraction, frame-differencing, dense-optical-flow, dnn-object-detection | |
| `webcam` | Webカメラ（ライブ） | ユーザーのカメラ映像（入力 `camera`）。サンプル画像ではなく入力手段 | webcam-capture, background-subtraction, optical-flow-lk, meanshift-camshift | |

> `webcam` は配布画像ではなくライブ入力。サンプル代替として `video-traffic` を用意しておくと、カメラ非許可時でも体験できる。
> `inpainting` / `grabcut` / `flood-fill` / `kmeans` 等は、サンプル画像に加えて **Canvas 描画入力（マスク/シード）** を併用する（`canvas-drawing-input` 参照）。

---

## デモ→必要画像 の逆引き（抜粋・MVP 中心）

| デモ | 推奨サンプル |
| --- | --- |
| grayscale-conversion | portrait, shapes |
| color-extraction-inrange / mask-operation | colored-objects |
| gaussian-blur / median-blur / average-blur | noisy |
| erosion / dilation / opening / closing | noisy-binary |
| simple/otsu/adaptive-threshold | document, receipt, shapes |
| canny / sobel / laplacian | building, shapes |
| find-contours 一式（面積/外接矩形/凸包/モーメント等） | shapes, coins, multi-objects |
| hough-line-detection | lines, building |
| hough-circle-detection | coins |
| template-matching | template-scene + template-patch |
| histogram-calculation / equalization | dark, low-contrast |
| affine / perspective-transform | building, document |
| brightness / contrast | dark, low-contrast |

---

## MVP 用 最小サンプルセット（11 枚）

MVP（44 デモ）を成立させるための最小限の画像です。これらを最優先で用意します。

1. `portrait` — 人物写真
2. `landscape` — 風景写真
3. `building` — 直線の多い建物
4. `document` — 斜めの書類
5. `shapes` — 単純図形
6. `coins` — 円（コイン）
7. `lines` — 直線主体
8. `colored-objects` — 色付き物体
9. `noisy` — ノイズ入り（カラー）
10. `noisy-binary` — ノイズ入り2値
11. `dark` または `low-contrast` — 暗い/低コントラスト

> `template-scene` / `template-patch` はテンプレートマッチングを MVP に含めるため追加で用意（実質 13 枚）。
> `noisy` / `noisy-binary` / `low-contrast` などは、元画像にプログラムで劣化を加えて生成してもよい（ノイズ付与・コントラスト圧縮）。これにより必要な実写枚数を削減できる。

---

## サンプル画像に関する実装前の要確認事項

- [ ] 各画像のライセンス/出典の確定（自作 / CC0 / OpenCV 公式サンプル）。
- [ ] 顔・人物画像の肖像権・利用許諾の確認（合成画像の利用検討）。
- [ ] `licenses` ページへの出典・ライセンス記載。
- [ ] 配置・命名規約（`public/samples/<id>.{jpg,png}`）とサムネイル生成。
- [ ] 動画サンプル（`video-traffic`）のサイズ・形式（mp4/webm）とブラウザ互換。
