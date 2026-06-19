# MVP スコープ定義 (MVP Scope)

OpenCV Playground の MVP（Minimum Viable Product）で実装すべき範囲を定義します。
本ファイルの判断は `src/data/opencvDemos.ts` の `isMvp` フラグ（**44 件が `true`**）と一致します。

---

## 1. MVP の定義と原則

> **MVP の核心**: 「**静止画 1 枚をアップロード（またはサンプル選択）し、パラメータを調整しながら OpenCV の代表的な処理を Before/After で体験し、コードと説明で学べる**」状態を完成させること。

原則:

1. **入力は静止画 1 枚に限定**（`image` / `sample-only`）。Web カメラ・動画・複数画像・描画入力は MVP 外（Phase 4 以降）。
2. **OpenCV.js で確実に動く機能のみ**。`opencvJsSupport` が `supported` のものを中心に選ぶ（`needs-investigation` / `not-supported` は MVP 外）。
3. **共通基盤（アップロード／比較／パラメータ／コード／説明）を最優先**。これが無いとどのデモも成立しない。
4. **1 つの処理パイプラインで複数デモが成立するもの**を優先（例: 2値化→輪郭→形状特徴量は 1 本の流れで多くのデモを生む）。
5. **重い処理・モデルファイル必須・対話必須の機能は除外**（バイラテラルは軽量サンプル限定で例外的に許可）。

MVP は 2 層に分けて考えます。

- **MVP Core**: 共通基盤 + Phase 1 の必須機能 + ユーザー指定候補。これ単体でプロダクトとして成立。
- **MVP Extended**: Core と同じパイプライン上に「ほぼ追加コストゼロ」で乗る機能（輪郭特徴量の家族など）。

---

## 2. 共通基盤機能（すべて MVP 必須）

| 機能 | デモ/部品ID | MVP | 理由 |
| --- | --- | --- | --- |
| 画像アップロード | `image-upload` | ✅ 入れる | すべてのデモの入口。D&D・自動リサイズ込み。これ無しに何も始まらない。 |
| サンプル画像選択 | (UI部品 + `sample-images.md`) | ✅ 入れる | 画像を持たないユーザーでも即体験できる。学習導線として必須。 |
| Before / After 表示 | `before-after-compare` | ✅ 入れる | 「効果を見る」ことが本アプリの価値の中心。最重要 UI。 |
| Split View 比較 | (`before-after-compare` のモード) | ✅ 入れる | スライダ式比較は理解効果が高い。Before/After に内包。 |
| パラメータ調整 | (各デモ `parameters`) | ✅ 入れる | 「触って分かる」体験の核。デバウンス付きで実装。 |
| コード例表示 | (各デモ `codeExample`) | ✅ 入れる | 学習価値の中心。最低 opencv.js を表示、Python 併記は任意。 |
| 処理説明表示 | (各デモ `description`/`longDescription`) | ✅ 入れる | 「何をしているか」を言語化。教育目的の必須要素。 |
| ユースケース表示 | (各デモ `useCases`) | ✅ 入れる | 実応用への橋渡し。軽量なので Core に含める。 |
| OpenCV.js対応バッジ | (`opencvJsSupport`) | ✅ 入れる | 正直さの担保。本アプリの方針上、最初から表示する。 |

---

## 3. MVP 対象デモ一覧（カテゴリ別 44 件）

### Core: Phase 1 基本処理（静止画1枚）

| ID | 表示名 | 入れる理由 |
| --- | --- | --- |
| grayscale-conversion | グレースケール変換 | 最も基本。全処理の入口。supported。 |
| image-resize | リサイズ | 基本操作。前処理にも必須。 |
| image-rotate | 回転 | 基本操作。傾き補正の理解。 |
| image-flip | 反転 | 最も単純で理解しやすい。 |
| image-crop | 切り抜き（ROI） | ROI の概念導入。ドラッグUIの土台。 |
| brightness-adjustment | 明るさ調整 | 「画素値の操作」を直感化。 |
| contrast-adjustment | コントラスト調整 | 明るさとペアで理解。 |
| rgb-hsv-conversion | RGB/HSV変換 | 色抽出の前提。色空間の理解。 |
| color-extraction-inrange | 色抽出（inRange） | 色ベース抽出の花形。インタラクティブ。 |
| mask-operation | マスク処理 | 色抽出の結果を活かす定番。 |
| average-blur | 平均ぼかし | ぼかしの基本。 |
| gaussian-blur | ガウシアンぼかし | 最頻出の平滑化。 |
| median-blur | メディアンぼかし | ノイズ除去の代表。効果が明確。 |
| bilateral-filter | バイラテラルフィルタ | エッジ保持の対比。※小画像限定で例外許可。 |
| sharpen-filter | シャープ化 | filter2D（畳み込み）の入口。 |
| simple-threshold | 通常二値化 | 2値化の基本。輪郭検出の前段。 |
| otsu-threshold | 大津の二値化 | 自動しきい値。教育的。 |
| adaptive-threshold | 適応的二値化 | 照明ムラ対応。書類スキャンの基礎。 |
| erosion | 収縮 | 形態学の基本。 |
| dilation | 膨張 | 形態学の基本。収縮とペア。 |
| opening | オープニング | 複合演算の理解。 |
| closing | クロージング | 複合演算の理解。 |
| canny-edge-detection | Cannyエッジ検出 | エッジ検出の代表。2しきい値が楽しい。 |
| sobel-derivative | Sobel微分 | 勾配の理解。 |
| laplacian | Laplacian | 2次微分エッジ。 |

### Extended: Phase 2 輪郭・形状（2値化パイプラインの延長）

| ID | 表示名 | 入れる理由 |
| --- | --- | --- |
| find-contours | 輪郭検出 | 形状解析の起点。MVP候補に明記。 |
| draw-contours | 輪郭描画 | 検出結果の可視化。必須ペア。 |
| contour-area | 面積計算 | MVP候補に明記。selection に有用。 |
| contour-perimeter | 周囲長計算 | find-contours から追加コスト小。 |
| polygon-approximation | 多角形近似 | 図形分類が映える。追加コスト小。 |
| bounding-rect | 外接矩形 | MVP候補に明記。検出枠の定番。 |
| rotated-rect | 回転矩形 | 同パイプライン。角度の学び。 |
| min-enclosing-circle | 最小外接円 | 同パイプライン。円物体に有用。 |
| convex-hull | 凸包 | 同パイプライン。凹凸の可視化。 |
| image-moments | モーメント・重心 | 同パイプライン。重心表示が分かりやすい。 |

### Extended: Phase 2 図形検出

| ID | 表示名 | 入れる理由 |
| --- | --- | --- |
| hough-line-detection | Hough直線検出 | MVP候補に明記。supported。映える。 |
| hough-circle-detection | Hough円検出 | MVP候補に明記。コイン計数が分かりやすい。 |
| template-matching | テンプレートマッチング | supported。第2画像はROI切り出しで MVP 内で完結可能。 |

### Extended: Phase 3 ヒストグラム・幾何変換

| ID | 表示名 | 入れる理由 |
| --- | --- | --- |
| histogram-calculation | ヒストグラム計算 | MVP候補に明記。チャート表示の導入。 |
| histogram-equalization | ヒストグラム均一化 | MVP候補に明記。効果が明確。 |
| affine-transform | アフィン変換 | MVP候補に明記。変換行列の理解。 |
| perspective-transform | 透視変換 | MVP候補に明記。書類正面化の花形。 |

> 合計 **44 件**（共通基盤を除くデモ数）。`getMvpDemos()` の返り値と一致。

---

## 4. ユーザー指定 MVP 候補の判定

タスクで提示された候補リストへの個別判定です。

| 候補 | 判定 | 対応デモ | 理由 |
| --- | --- | --- | --- |
| 画像アップロード | ✅ 入れる | image-upload | 全機能の前提。 |
| サンプル画像選択 | ✅ 入れる | (UI部品) | 画像を持たない人の導線。 |
| Before/After表示 | ✅ 入れる | before-after-compare | 価値の中心。 |
| パラメータ調整 | ✅ 入れる | (各 parameters) | 体験の核。 |
| コード例表示 | ✅ 入れる | (各 codeExample) | 学習価値。 |
| 処理説明表示 | ✅ 入れる | (各 description) | 教育目的。 |
| グレースケール | ✅ 入れる | grayscale-conversion | 基本中の基本。 |
| HSV変換 | ✅ 入れる | rgb-hsv-conversion | 色抽出の前提。 |
| 色抽出 | ✅ 入れる | color-extraction-inrange | インタラクティブで映える。 |
| ぼかし（平均） | ✅ 入れる | average-blur | 基本フィルタ。 |
| ガウシアンぼかし | ✅ 入れる | gaussian-blur | 最頻出。 |
| メディアンぼかし | ✅ 入れる | median-blur | 効果が明確。 |
| 二値化 | ✅ 入れる | simple-threshold | 2値化の基本。 |
| 適応的二値化 | ✅ 入れる | adaptive-threshold | 文書処理に有用。 |
| Cannyエッジ検出 | ✅ 入れる | canny-edge-detection | エッジの代表。 |
| Sobel | ✅ 入れる | sobel-derivative | 勾配の理解。 |
| Laplacian | ✅ 入れる | laplacian | 2次微分。 |
| 輪郭検出 | ✅ 入れる | find-contours | 形状解析の起点。 |
| 輪郭描画 | ✅ 入れる | draw-contours | 可視化に必須。 |
| 面積計算 | ✅ 入れる | contour-area | 物体選別に有用。 |
| 外接矩形 | ✅ 入れる | bounding-rect | 検出枠の定番。 |
| Hough直線検出 | ✅ 入れる | hough-line-detection | supported。映える。 |
| Hough円検出 | ✅ 入れる | hough-circle-detection | コイン計数が分かりやすい。 |
| ヒストグラム表示 | ✅ 入れる | histogram-calculation | 解析カテゴリの導入。 |
| ヒストグラム均一化 | ✅ 入れる | histogram-equalization | 効果が明確。 |
| リサイズ | ✅ 入れる | image-resize | 基本操作。 |
| 回転 | ✅ 入れる | image-rotate | 基本操作。 |
| 反転 | ✅ 入れる | image-flip | 最も単純。 |
| アフィン変換 | ✅ 入れる | affine-transform | 変換行列の理解。 |
| 透視変換 | ✅ 入れる | perspective-transform | 書類正面化の花形。 |

> ユーザー指定候補は**すべて MVP に採用**。これらに、同パイプラインで低コストに追加できる輪郭特徴量・形態学の複合演算・テンプレートマッチング等を加えて 44 件とした。

---

## 5. MVP に「含めない」機能と理由

| 機能 / カテゴリ | 判定 | 理由 |
| --- | --- | --- |
| Webカメラ・動画処理（背景差分, Optical Flow, Camshift） | ❌ Phase 4 | ライブ入力・フレームループが MVP の「静止画1枚」原則を超える。HTTPS/権限/性能も増える。 |
| 顔検出・物体検出（Haar, QR, DNN） | ❌ Phase 5/7 | カスケード XML / モデルファイルのロードが必要。MVP のシンプルさを損なう。 |
| 特徴点マッチング・Homography | ❌ Phase 6 | 複数画像入力が前提。MVP は単一画像に限定。 |
| パノラマ合成（Stitcher） | ❌ Phase 6 | 複数画像 + Stitcher の opencv.js 提供が `needs-investigation`。 |
| DNN 推論（分類/検出） | ❌ Phase 7 | モデルサイズ・速度・出力デコードが重い。`needs-investigation`。 |
| GrabCut / Watershed / Flood Fill | ❌ Phase 3 (後半) | 対話的入力・重い処理・手順の多さ。MVP の単純さを優先。 |
| CLAHE / ヒストグラム比較 / バックプロジェクション | ❌ Phase 3 | CLAHE は `likely-supported`（バインディング要確認）、比較は複数画像前提。 |
| インペインティング / スタイライズ（photo） | ❌ Phase 3 | `photo` モジュールの opencv.js 含有が `needs-investigation`。 |
| SIFT / NL-Means / kNN / カメラキャリブレーション | ❌ 各Phase | opencv.js 提供が `needs-investigation`、または重い/複数画像。 |
| Scharr / 画像ピラミッド / チャンネル分割 等 | ❌ 近MVP | supported だが学習導線上の優先度が一段低い。Phase 1 の「すぐ次」で追加。 |
| 書類スキャン風補正（複合レシピ） | ❌ Phase 3 | 透視変換 + 四隅自動検出の複合。MVP は要素技術（透視変換）までに留める。 |

> 注: `bilateral-filter` のみ「重い処理だが学習価値が高い」ため、入力画像を自動縮小する前提で MVP に例外的に含めた。

---

## 6. MVP 完了条件 (Definition of Done)

- [ ] OpenCV.js（WASM）の読み込みとエラーハンドリングが動作する。
- [ ] 画像アップロード（D&D / ファイル選択）と自動リサイズが動作する。
- [ ] サンプル画像が最低限のセット（`sample-images.md` の MVP 用）で選択できる。
- [ ] Before/After（並列 + スライダ比較）が全 MVP デモで動作する。
- [ ] 44 件の MVP デモがパラメータ調整付きで動作し、結果が正しく表示される。
- [ ] 各デモでコード例・説明・ユースケース・OpenCV関数・難易度・OpenCV.js対応バッジ・注意点が表示される。
- [ ] すべての `cv.Mat` / `MatVector` 等が確実に `delete()` され、メモリリークが無い。
- [ ] スマホのモダンブラウザで主要デモが破綻なく動作する。
- [ ] OpenCV の Apache 2.0 ライセンス表記とサンプル画像の出典表記がある。

---

## 7. サマリ

- **MVP デモ数**: 44 件（`isMvp: true`）
- **MVP の OpenCV.js 対応**: 全件 `supported`（唯一 `bilateral-filter` は重いが supported）
- **MVP の入力**: `image` / `sample-only` のみ（複数画像・カメラ・動画・描画は除外）
- **MVP の中心パイプライン**: 「読み込み → 前処理（色/フィルタ/二値化/形態学）→ 解析（エッジ/輪郭/形状/ヒストグラム/幾何変換）→ Before/After + コード + 説明」
