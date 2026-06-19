# OpenCV Playground

ブラウザ上で OpenCV の機能を実際に試しながら学べる、**サーバーレスSPA**の Web アプリケーション。

画像をアップロード（またはサンプル選択・Webカメラ）し、OpenCV の各機能（グレースケール / Cannyエッジ検出 / 輪郭検出 / 透視変換 など）をパラメータ調整付きで体験できます。**画像処理はすべて OpenCV.js（WebAssembly）でブラウザ内完結**し、画像はサーバーに送信されません。

---

## 📌 プロジェクトの現状

> **現在は「仕様・データ定義フェーズ」です。** アプリ本体（React コンポーネント等）はこれから実装します。
> 何を・どの順で作るかは [`docs/spec/`](docs/spec/) の仕様書群と [`src/data/`](src/data/) のデータ定義で確定済みです。

| 指標 | 値 |
| --- | --- |
| 機能カテゴリ | 20 |
| デモ候補 | 91（うち MVP 対象 44） |
| 対象 | OpenCV 4.x / OpenCV.js（WASM） |
| 想定スタック | React + TypeScript + Vite（静的ホスティング） |

---

## 🗂 リポジトリ構成

```
opencv-playground/
├── README.md                  # このファイル
├── docs/
│   └── spec/                  # 仕様書（人間が読む正典）
│       ├── overview.md                      # 目的・対象ユーザー・提供価値
│       ├── opencv-feature-taxonomy.md       # 20大カテゴリの体系
│       ├── opencv-feature-catalog.md        # 91デモの機能カタログ
│       ├── mvp-scope.md                     # MVP範囲（44件）の判定
│       ├── phases.md                        # 開発フェーズ Phase 1〜7
│       ├── data-model.md                    # TypeScript型定義
│       ├── sample-images.md                 # サンプル画像要件
│       ├── ui-requirements.md               # UI要件
│       ├── non-functional-requirements.md   # 非機能要件
│       └── research-notes.md                # OpenCV.js調査メモ
└── src/
    └── data/                  # アプリで使うデータ定義（機械可読の正典）
        ├── opencvCategories.ts             # 20カテゴリ
        └── opencvDemos.ts                  # 91デモ
```

`opencvDemos.ts` が機械可読の正典、`docs/spec/opencv-feature-catalog.md` がその人間可読版です。両者の ID は一致しています。

---

## 🛠 ビルド手順

### 前提

- **Node.js 18 以上**（推奨 20+。動作確認は v24）
- npm（または pnpm / yarn）

### 1. データ定義の検証（いますぐ実行可能）

アプリを未スキャフォールドの現段階でも、データ定義（`src/data/*.ts`）の**構文・import 解決**は検証できます。インストール不要です。

```bash
# 構文チェック + import 解決の検証（esbuild で一括バンドル）
npx --yes esbuild src/data/opencvCategories.ts src/data/opencvDemos.ts \
  --bundle --format=esm --outdir=/tmp/ocv-check
# エラーが出力されなければ OK
```

### 2. アプリのセットアップ（実装フェーズで実施）

アプリ本体はまだスキャフォールドされていません。実装着手時は Vite + React + TypeScript で初期化します。

```bash
# 例: 既存ディレクトリに Vite(React+TS) を導入
npm create vite@latest . -- --template react-ts
npm install

# OpenCV.js を利用（CDN 読み込み、または npm パッケージ/自前ホスト）
# 詳細な読み込み方針は docs/spec/non-functional-requirements.md を参照
```

### 3. 開発・ビルド・プレビュー（Vite 導入後に有効）

```bash
npm run dev       # 開発サーバ（http://localhost:5173）
npm run build     # 本番ビルド（dist/ に静的成果物を出力）
npm run preview   # ビルド成果物のローカル確認
```

> ⚠️ Webカメラ機能（Phase 4 以降）は **HTTPS（または localhost）必須**です。`npm run dev` は localhost のため動作します。

### 4. デプロイ（静的ホスティング）

`npm run build` で生成される `dist/` を静的ホスティング（GitHub Pages / Netlify / Cloudflare Pages 等）に配置します。SPA のため、ルーティングのフォールバック設定（全てを `index.html` に転送）が必要です。詳細は [`docs/spec/non-functional-requirements.md`](docs/spec/non-functional-requirements.md)。

---

## 📖 仕様ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [overview.md](docs/spec/overview.md) | アプリの目的・対象ユーザー・提供価値・基本方針 |
| [opencv-feature-taxonomy.md](docs/spec/opencv-feature-taxonomy.md) | OpenCV 機能の 20 大カテゴリ体系 |
| [opencv-feature-catalog.md](docs/spec/opencv-feature-catalog.md) | 91 デモの機能カタログ（全項目を表形式） |
| [mvp-scope.md](docs/spec/mvp-scope.md) | MVP（44 件）の範囲と採否理由 |
| [phases.md](docs/spec/phases.md) | 開発フェーズ Phase 1〜7 |
| [data-model.md](docs/spec/data-model.md) | TypeScript 型定義（`OpenCvDemo` 他） |
| [sample-images.md](docs/spec/sample-images.md) | 必要なサンプル画像とデモ対応 |
| [ui-requirements.md](docs/spec/ui-requirements.md) | UI 要件 |
| [non-functional-requirements.md](docs/spec/non-functional-requirements.md) | 非機能要件（メモリ管理 / WASM / プライバシー 他） |
| [research-notes.md](docs/spec/research-notes.md) | OpenCV.js 対応状況の調査メモ |

---

## 🚧 次の実装ステップ（推奨順）

1. **基盤**: OpenCV.js ローダ → `cv.Mat.delete()` 規約とスコープ自動解放ヘルパ → 画像アップロード/自動リサイズ → Before/After 比較
2. **Phase 1 デモ**: グレースケール → リサイズ/回転/反転 → ぼかし → 二値化 → Canny → 色抽出
3. **Phase 2**: 2値化→輪郭検出→形状特徴量、Hough 直線・円
4. **Phase 3**: ヒストグラム、アフィン/透視変換（→ MVP 完成）
5. **Phase 4 以降**: Webカメラ・検出・特徴点マッチング・DNN

詳細は [`docs/spec/phases.md`](docs/spec/phases.md) を参照。

---

## ⚖️ ライセンス / 表記

- **OpenCV** は Apache License 2.0。OpenCV.js を同梱・配信する際はライセンス表記が必要です。
- **サンプル画像**は自作 / CC0 / OpenCV 公式サンプル等、再配布可能なもののみを使用し、出典を明記します（[sample-images.md](docs/spec/sample-images.md) 参照）。
- DNN モデルファイルを使う機能（Phase 5/7）は、各モデルのライセンスに従います。
