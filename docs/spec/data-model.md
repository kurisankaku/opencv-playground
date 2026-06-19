# データモデル定義 (Data Model)

OpenCV Playground のデモ機能を、アプリ内で型安全に管理するための TypeScript データ構造を定義します。
ここで定義する型は `src/data/opencvCategories.ts` および `src/data/opencvDemos.ts` がそのまま実装で使用します。

- 対象: OpenCV 4.x 系
- 前提: TypeScript / React (Vite or Next.js static export 想定)
- 方針: OpenCV 本体の機能定義と「OpenCV.js でブラウザ実装できるか」のステータスを **必ず分離** して持つ。

---

## 1. 列挙的な基本型 (Enumerations)

分類ルールに従い、すべて文字列リテラル union で定義します（`enum` ではなく union 型にすることで、JSON 直列化・URL 化・ツリーシェイクに有利）。

```ts
/** 実装難易度。UI のバッジ表示や絞り込みに使用する。 */
export type DemoDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * 機能の優先度。
 * S = 最優先 (Playground の看板機能 / 学習導線の中心)
 * A = 高 (主要機能)
 * B = 中 (あると価値が高い発展機能)
 * C = 低 (将来 / ニッチ / 要調査が多い)
 */
export type DemoPriority = 'S' | 'A' | 'B' | 'C';

/** 開発フェーズ。ロードマップ・ガント・実装順の管理に使用する。 */
export type DemoPhase =
  | 'phase-1' // 静止画1枚の基本処理
  | 'phase-2' // 輪郭・形状・図形検出
  | 'phase-3' // ヒストグラム・幾何変換・実用レシピ
  | 'phase-4' // Webカメラ・動画処理
  | 'phase-5' // 顔検出・物体検出
  | 'phase-6' // 特徴点マッチング・パノラマ
  | 'phase-7'; // DNN・高度な Computer Vision

/**
 * デモが受け付ける入力の種類。
 * - image:            静止画1枚
 * - multiple-images:  複数画像（マッチング/合成/比較）
 * - video:            動画ファイル（フレーム列）
 * - camera:           Webカメラのライブ入力
 * - drawing:          Canvas 上のユーザー描画（マーカー/ROI 指定など）
 * - sample-only:      ユーザー入力不可、用意したサンプルのみで成立するデモ
 */
export type DemoInputType =
  | 'image'
  | 'multiple-images'
  | 'video'
  | 'camera'
  | 'drawing'
  | 'sample-only';

/**
 * デモの出力（結果）の種類。1つのデモが複数の出力を持つことがある。
 * - image:    変換後の画像
 * - mask:     2値マスク画像
 * - overlay:  入力画像の上に検出結果（線・点・矩形・輪郭）を重畳した画像
 * - chart:    グラフ（ヒストグラム等）
 * - numeric:  数値（面積・周囲長・座標・スコア等）
 * - text:     テキスト（クラス名・判定結果等）
 * - geometry: 幾何情報（矩形・多角形・行列）。JSON で表示・コピー可能にする。
 * - video:    動画 / 連続フレーム出力
 */
export type DemoOutputType =
  | 'image'
  | 'mask'
  | 'overlay'
  | 'chart'
  | 'numeric'
  | 'text'
  | 'geometry'
  | 'video';

/**
 * OpenCV.js でブラウザ実装できるかのステータス。
 * 「OpenCV 本体にあるか」ではなく「公式 opencv.js / WASM でブラウザ動作できるか」を表す。
 *
 * - supported:                公式 opencv.js のデフォルトビルドに含まれ、ブラウザで動作確認が見込める
 * - likely-supported:         モジュールは含まれる見込みだが、API 公開/挙動の最終確認が必要
 * - needs-investigation:      ビルド有無・モデル要否・性能などを実装前に要調査
 * - not-supported:            opencv.js デフォルトビルドに含まれない / contrib 依存で未提供の見込み
 * - not-suitable-for-browser: 技術的には可能でもブラウザ向けでない（重すぎる/対話前提/ネイティブ I/O 前提）
 *
 * 参考: タスク仕様で挙げられた supported_in_opencv_js / likely_supported_in_opencv_js /
 *       needs_investigation / not_suitable_for_browser / server_or_native_recommended は
 *       それぞれ supported / likely-supported / needs-investigation /
 *       not-suitable-for-browser / not-supported に対応づける。
 */
export type OpenCvJsSupportStatus =
  | 'supported'
  | 'likely-supported'
  | 'needs-investigation'
  | 'not-supported'
  | 'not-suitable-for-browser';

/**
 * OpenCV モジュール識別子。contrib 由来のものは "-contrib" を付け、本体と区別する。
 * （`isContrib` フラグでも判定できるが、表示・集計用に名前自体も分離する）
 */
export type OpenCvModule =
  | 'core'
  | 'imgproc'
  | 'imgcodecs'
  | 'highgui'
  | 'videoio'
  | 'video'
  | 'objdetect'
  | 'features2d'
  | 'calib3d'
  | 'photo'
  | 'stitching'
  | 'ml'
  | 'dnn'
  | 'flann'
  | 'js' // opencv.js / ブラウザ連携固有(canvas, VideoCapture ラッパ等)
  | 'xfeatures2d-contrib'
  | 'face-contrib'
  | 'tracking-contrib'
  | 'ximgproc-contrib'
  | 'bgsegm-contrib'
  | 'aruco-contrib';
```

---

## 2. 補助型 (Supporting types)

```ts
/** OpenCV の関数 / クラスへの参照。 */
export interface OpenCvFunctionRef {
  /** 呼び出し名。opencv.js 表記に寄せる。例: 'cv.cvtColor', 'cv.CascadeClassifier' */
  name: string;
  /** 所属モジュール。 */
  module: OpenCvModule;
  /** contrib 由来か（OpenCV 本体に含まれない）。 */
  isContrib?: boolean;
  /** 公式ドキュメント URL（任意）。 */
  docUrl?: string;
}

/** UI 上でユーザーが操作できるパラメータ定義。 */
export interface DemoParameter {
  /** 一意 ID（kebab-case）。状態管理キー / クエリパラメータに使用。 */
  id: string;
  /** 表示名（日本語）。 */
  nameJa: string;
  /** 表示名（英語）。 */
  nameEn: string;
  /**
   * UI コントロールの種類。
   * - slider:      連続値スライダ
   * - number:      数値入力
   * - select:      選択肢（しきい値タイプ / カーネル形状など）
   * - toggle:      ON/OFF
   * - color:       色指定（HSV/RGB 範囲）
   * - point:       画像上の点指定
   * - kernel-size: 奇数限定のカーネルサイズ
   */
  control: 'slider' | 'number' | 'select' | 'toggle' | 'color' | 'point' | 'kernel-size';
  /** このパラメータが何をするかの説明。 */
  description: string;
  /** 既定値。 */
  default: number | string | boolean | number[];
  min?: number;
  max?: number;
  step?: number;
  /** control === 'select' の選択肢。value は OpenCV のフラグ名や数値。 */
  options?: { label: string; value: string | number }[];
  /** 対応する OpenCV 引数名（例: 'ksize', 'threshold1'）。学習用に表示する。 */
  opencvArg?: string;
}

/** サンプル画像への参照。詳細は docs/spec/sample-images.md と対応。 */
export interface SampleImageRef {
  /** 画像 ID（kebab-case）。例: 'shapes-basic', 'coins', 'document-skewed'。 */
  id: string;
  /** 表示名。 */
  label: string;
  /** public 配下の相対パス（実装時に配置）。 */
  path?: string;
}

/** 学習用コードサンプル。 */
export interface CodeExample {
  /** 言語。Playground は opencv.js を中心に Python も併記すると学習価値が高い。 */
  language: 'javascript' | 'python' | 'cpp';
  /** コード本体。 */
  code: string;
  /** 補足説明（任意）。 */
  caption?: string;
}

/** 外部参照リンク。 */
export interface DocReference {
  title: string;
  url: string;
}
```

---

## 3. カテゴリ型 (Category)

```ts
/** OpenCV 機能の大カテゴリ。`src/data/opencvCategories.ts` で 20 件以上定義する。 */
export interface OpenCvCategory {
  /** 一意 ID（kebab-case）。デモの categoryId から参照される。 */
  id: string;
  /** URL スラッグ（通常 id と同一）。 */
  slug: string;
  /** カテゴリ名（日本語）。 */
  nameJa: string;
  /** カテゴリ名（英語）。 */
  nameEn: string;
  /** カテゴリの説明。 */
  description: string;
  /** 関連する OpenCV モジュール。 */
  opencvModules: OpenCvModule[];
  /** このカテゴリが主に登場するフェーズ。 */
  phase: DemoPhase;
  /** カテゴリ全体の優先度。 */
  priority: DemoPriority;
  /** MVP 候補カテゴリか。 */
  isMvpCandidate: boolean;
  /** 表示順（小さいほど先頭）。任意。 */
  displayOrder?: number;
  /** Web アプリ上での代表的な見せ方（任意・taxonomy と対応）。 */
  webAppPresentation?: string;
}
```

---

## 4. デモ型 (Demo) — 中心となる型

`OpenCvDemo` がアプリの中核データです。
`src/data/opencvDemos.ts` の各エントリはこの型に準拠します。
**必須フィールド**は `opencvDemos.ts` が必ず持つもの、**任意フィールド**はカタログ/詳細ページ用に後から拡充できるものです。

```ts
export interface OpenCvDemo {
  /** 一意 ID（kebab-case）。URL・状態管理・コードで使用。slug と同一にしてよい。 */
  id: string;
  /** URL スラッグ（kebab-case）。 */
  slug: string;

  /** 表示名（日本語）。 */
  titleJa: string;
  /** 表示名（英語）。 */
  titleEn: string;

  /** 所属カテゴリ ID（OpenCvCategory.id を参照）。 */
  categoryId: string;
  /** サブカテゴリ（自由記述・絞り込み用）。 */
  subcategory: string;

  /** 一覧カード用の短い説明（1〜2文）。 */
  description: string;
  /** 詳細ページ用の長い説明（任意）。 */
  longDescription?: string;

  /** 代表的なユースケース。 */
  useCases: string[];

  /** 使用する OpenCV 関数 / クラス。 */
  opencvFunctions: OpenCvFunctionRef[];
  /** 関連 OpenCV モジュール。 */
  opencvModules: OpenCvModule[];

  /** 受け付ける入力タイプ。 */
  inputTypes: DemoInputType[];
  /** 出力タイプ。 */
  outputTypes: DemoOutputType[];

  /** ユーザー調整パラメータ。 */
  parameters: DemoParameter[];

  /** 推奨サンプル画像（任意）。 */
  sampleImages?: SampleImageRef[];

  /** 難易度。 */
  difficulty: DemoDifficulty;
  /** 優先度。 */
  priority: DemoPriority;
  /** 開発フェーズ。 */
  phase: DemoPhase;
  /** MVP 対象か。 */
  isMvp: boolean;

  /** OpenCV.js 対応見込み。 */
  opencvJsSupport: OpenCvJsSupportStatus;
  /** ブラウザ対応に関する補足（任意）。 */
  browserSupportNotes?: string;

  /** 実装メモ（任意でない: 実装方針の要点を必ず1行以上）。 */
  implementationNotes: string;
  /** 制約・注意点（精度/性能/前処理依存など）。 */
  limitations: string;

  /** 学習用コードサンプル（最低1つ）。 */
  codeExample: CodeExample;
  /** 外部参照（任意）。 */
  references?: DocReference[];
}
```

---

## 5. 補足: カタログ表との対応

`docs/spec/opencv-feature-catalog.md` の各列は本型に対応します。

| カタログ列 | 対応フィールド |
| --- | --- |
| ID | `id` |
| 表示名 | `titleJa` |
| 英語名 | `titleEn` |
| カテゴリ | `categoryId` |
| サブカテゴリ | `subcategory` |
| 説明 | `description` |
| 主な OpenCV 関数・クラス | `opencvFunctions[].name` |
| 対応モジュール | `opencvModules` |
| 入力タイプ | `inputTypes` |
| 出力タイプ | `outputTypes` |
| 調整パラメータ | `parameters[].nameJa` |
| 必要なサンプル画像 | `sampleImages[].label` |
| 代表的ユースケース | `useCases` |
| 難易度 | `difficulty` |
| 優先度 | `priority` |
| OpenCV.js 対応見込み | `opencvJsSupport` |
| MVP 対象か | `isMvp` |
| 実装メモ | `implementationNotes` |
| 注意点 | `limitations` |

---

## 6. 設計上の注意

- `opencvJsSupport` は **OpenCV 本体の機能有無とは独立**。本体にあっても opencv.js では `needs-investigation` になり得る。
- contrib 依存は `OpenCvFunctionRef.isContrib` と `OpenCvModule` の `-contrib` サフィックスの両方で判定可能にする。
- `parameters[].default` は OpenCV のデフォルト挙動に寄せ、初回表示で「素の結果」が見えるようにする。
- メモリ管理（`cv.Mat.delete()`）は型ではなく実装規約で扱う（`docs/spec/non-functional-requirements.md` 参照）。
