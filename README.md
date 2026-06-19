# OpenCV Playground

ブラウザ上で OpenCV の機能を実際に試しながら学べる、**サーバーレスSPA**の Web アプリケーション。

画像をアップロード（またはサンプル選択・Webカメラ）し、OpenCV の各機能（グレースケール / Cannyエッジ検出 / 輪郭検出 / 透視変換 など）をパラメータ調整付きで体験できます。**画像処理はすべて OpenCV.js（WebAssembly）でブラウザ内完結**し、画像はサーバーに送信されません。

---

## 📌 プロジェクトの現状

> **アプリ実装済み（継続開発中）。** Phase 1〜2 を中心に **31 デモがブラウザで実際に動作**します。
> 残りのデモは仕様（[`docs/spec/`](docs/spec/) / [`src/data/`](src/data/)）として定義済みで、詳細ページから閲覧できます。

| 指標 | 値 |
| --- | --- |
| 機能カテゴリ | 20 |
| デモ定義 | 91（うち MVP 対象 44） |
| 体験できるデモ | 31（インタラクティブ実装済み） |
| 対象 | OpenCV 4.x / OpenCV.js（WASM） |
| スタック | React · TypeScript · Vite · Tailwind CSS v4 · Framer Motion · OpenCV.js |

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
├── index.html · vite.config.ts · tsconfig.json
└── src/
    ├── main.tsx · App.tsx              # エントリ / ルーティング (HashRouter)
    ├── index.css                       # Tailwind v4 + デザイントークン (Vision Lab)
    ├── data/                           # 機械可読の正典
    │   ├── opencvCategories.ts         # 20カテゴリ
    │   └── opencvDemos.ts              # 91デモ
    ├── lib/                            # 処理エンジン
    │   ├── loadOpenCV.ts               # OpenCV.js 遅延ローダ
    │   ├── cvUtils.ts                  # Mat メモリ管理 (Scope) / 画像変換
    │   ├── processors.ts               # 31デモの実処理レジストリ
    │   └── sampleImages.ts             # 手続き生成サンプル画像
    ├── context/OpenCvContext.tsx       # ランタイム状態
    ├── components/                     # CompareView / ParamPanel / DemoRunner ほか
    └── pages/                          # Home / DemoList / DemoDetail
```

`opencvDemos.ts` が機械可読の正典、`docs/spec/opencv-feature-catalog.md` がその人間可読版です。両者の ID は一致しています。
処理関数を持つデモは `src/lib/processors.ts` に登録され、詳細ページでインタラクティブに動作します（未登録のデモは仕様として閲覧可能）。

---

## 🛠 ビルド手順

### 前提

- **Node.js 18 以上**（推奨 20+。動作確認は v24）
- npm（または pnpm / yarn）

### 1. セットアップ & 開発

```bash
npm install
npm run dev       # 開発サーバ（http://localhost:5173）
```

ブラウザで開くと、初回に OpenCV.js（WebAssembly, 約 8–10MB）を CDN（`docs.opencv.org/4.x/opencv.js`）から遅延ロードします。ヘッダーの「OpenCV.js 準備完了」表示が出れば、各デモがインタラクティブに動作します。

### 2. ビルド & プレビュー

```bash
npm run build     # 型チェック (tsc) + 本番ビルド → dist/
npm run preview   # dist/ をローカル配信して確認
npm run typecheck # 型チェックのみ
```

> ⚠️ Webカメラ機能（Phase 4 以降の実装予定分）は **HTTPS（または localhost）必須**です。`npm run dev` は localhost のため動作します。

### 3. デプロイ（静的ホスティング）

`npm run build` で生成される `dist/` を静的ホスティング（GitHub Pages / Netlify / Cloudflare Pages 等）に配置します。ルーティングは **HashRouter**（`/#/demos` 形式）、アセットパスは相対（`base: './'`）のため、サーバー側のリライト設定なしでサブパス配信にも対応します。詳細は [`docs/spec/non-functional-requirements.md`](docs/spec/non-functional-requirements.md)。

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

## ✅ 実装済み / 🚧 今後の拡張

**実装済み（31 デモ・インタラクティブ）**

- 基盤: OpenCV.js 遅延ローダ、`Scope` による `cv.Mat.delete()` 自動解放、画像アップロード/自動リサイズ、手続き生成サンプル、Before/After スライダ比較、コード例・処理説明・対応バッジ表示
- Phase 1: グレースケール / リサイズ / 回転 / 反転 / 明るさ / コントラスト / チャンネル分割 / セピア / RGB-HSV / 色抽出 / 各種ぼかし / シャープ化 / 二値化（通常・大津・適応的） / 形態学（収縮・膨張・オープニング・クロージング） / Canny・Sobel・Laplacian
- Phase 2: 輪郭検出 / 面積 / 外接矩形 / Hough 直線・円
- Phase 3（一部）: ヒストグラム均一化

**今後の拡張**

1. **Phase 3 残り**: アフィン/透視変換（4点ドラッグ UI）、書類スキャン、ヒストグラムのチャート描画、CLAHE
2. **Phase 4**: Webカメラ入力、背景差分、Optical Flow（フレームループ + Web Worker 化）
3. **Phase 5**: 顔検出（Haar カスケード）、QR、DNN 顔検出
4. **Phase 6–7**: 特徴点マッチング、パノラマ、DNN 推論

実装の優先順位と完了条件は [`docs/spec/phases.md`](docs/spec/phases.md) を参照。

詳細は [`docs/spec/phases.md`](docs/spec/phases.md) を参照。

---

## ⚖️ ライセンス / 表記

- **OpenCV** は Apache License 2.0。OpenCV.js を同梱・配信する際はライセンス表記が必要です。
- **サンプル画像**は自作 / CC0 / OpenCV 公式サンプル等、再配布可能なもののみを使用し、出典を明記します（[sample-images.md](docs/spec/sample-images.md) 参照）。
- DNN モデルファイルを使う機能（Phase 5/7）は、各モデルのライセンスに従います。
