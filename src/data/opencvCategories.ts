/**
 * OpenCV Playground — カテゴリ定義（ソース・オブ・トゥルース）
 *
 * 大カテゴリ 20 件。`opencvDemos.ts` の `categoryId` はここで定義した `id` を参照する。
 * 型定義は docs/spec/data-model.md / 将来的に src/types に切り出す。
 *
 * 対象: OpenCV 4.x。contrib 依存モジュールは "-contrib" サフィックスで区別する。
 */

export type DemoPhase =
  | 'phase-1'
  | 'phase-2'
  | 'phase-3'
  | 'phase-4'
  | 'phase-5'
  | 'phase-6'
  | 'phase-7';

export type DemoPriority = 'S' | 'A' | 'B' | 'C';

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
  | 'js'
  | 'xfeatures2d-contrib'
  | 'face-contrib'
  | 'tracking-contrib'
  | 'ximgproc-contrib'
  | 'bgsegm-contrib'
  | 'aruco-contrib';

export interface OpenCvCategory {
  id: string;
  slug: string;
  nameJa: string;
  nameEn: string;
  description: string;
  opencvModules: OpenCvModule[];
  phase: DemoPhase;
  priority: DemoPriority;
  isMvpCandidate: boolean;
  displayOrder?: number;
  webAppPresentation?: string;
}

export const openCvCategories: OpenCvCategory[] = [
  {
    id: 'image-basics',
    slug: 'image-basics',
    nameJa: '画像の基本操作',
    nameEn: 'Image Basics',
    description:
      '画像の読み込み・表示・サイズ変更・回転・反転・切り抜き・明るさ/コントラスト調整・チャンネル操作など、すべての処理の土台となる基本操作。',
    opencvModules: ['core', 'imgproc'],
    phase: 'phase-1',
    priority: 'S',
    isMvpCandidate: true,
    displayOrder: 1,
    webAppPresentation: 'Before/After 表示とスライダで、最も直感的に「画像＝数値の配列」を体験させる入口。',
  },
  {
    id: 'color-conversion',
    slug: 'color-conversion',
    nameJa: '色の変換・色抽出',
    nameEn: 'Color Conversion & Extraction',
    description:
      'RGB/グレースケール/HSV/Lab など色空間の相互変換と、特定の色領域の抽出（inRange）・マスク生成。色ベースの物体抽出の基礎。',
    opencvModules: ['imgproc', 'core'],
    phase: 'phase-1',
    priority: 'S',
    isMvpCandidate: true,
    displayOrder: 2,
    webAppPresentation: 'HSV のカラーピッカーで色範囲を指定 → 抽出マスクとマスク適用結果をリアルタイム表示。',
  },
  {
    id: 'filtering-denoising',
    slug: 'filtering-denoising',
    nameJa: 'フィルタ・ノイズ除去',
    nameEn: 'Filtering & Denoising',
    description:
      '平均/ガウシアン/メディアン/バイラテラルなどの平滑化、シャープ化、任意カーネルの畳み込み（filter2D）。ノイズ低減と前処理の中心。',
    opencvModules: ['imgproc', 'photo'],
    phase: 'phase-1',
    priority: 'S',
    isMvpCandidate: true,
    displayOrder: 3,
    webAppPresentation: 'カーネルサイズ/σ をスライダ操作し、ぼけ具合・エッジ保持の違いを並べて比較。',
  },
  {
    id: 'thresholding',
    slug: 'thresholding',
    nameJa: '二値化・しきい値処理',
    nameEn: 'Thresholding',
    description:
      '固定しきい値・大津の自動しきい値・適応的しきい値による2値化。前景/背景分離やOCR前処理の基礎。',
    opencvModules: ['imgproc'],
    phase: 'phase-1',
    priority: 'S',
    isMvpCandidate: true,
    displayOrder: 4,
    webAppPresentation: 'しきい値スライダと手法切替で、白黒の分かれ目がどう動くかを体感させる。',
  },
  {
    id: 'morphology',
    slug: 'morphology',
    nameJa: '形態学的変換',
    nameEn: 'Morphological Transforms',
    description:
      '収縮・膨張・オープニング・クロージング・トップハット等。2値画像のノイズ除去・穴埋め・領域整形に使う。',
    opencvModules: ['imgproc'],
    phase: 'phase-1',
    priority: 'A',
    isMvpCandidate: true,
    displayOrder: 5,
    webAppPresentation: 'カーネル形状/サイズ/反復回数を変えて、小さな点が消える・穴が埋まる様子を可視化。',
  },
  {
    id: 'edge-gradient',
    slug: 'edge-gradient',
    nameJa: 'エッジ・勾配検出',
    nameEn: 'Edge & Gradient Detection',
    description:
      'Canny・Sobel・Scharr・Laplacian による輪郭線/勾配の抽出。形状認識や特徴抽出の前段。',
    opencvModules: ['imgproc'],
    phase: 'phase-1',
    priority: 'S',
    isMvpCandidate: true,
    displayOrder: 6,
    webAppPresentation: '2つのしきい値スライダで Canny のエッジ量が変わる様子をライブ表示。',
  },
  {
    id: 'contours-shape',
    slug: 'contours-shape',
    nameJa: '輪郭・形状検出',
    nameEn: 'Contours & Shape Analysis',
    description:
      '輪郭の抽出・描画と、面積・周囲長・外接矩形・凸包・モーメント等の形状特徴量計算。物体計測・カウントの基礎。',
    opencvModules: ['imgproc'],
    phase: 'phase-2',
    priority: 'S',
    isMvpCandidate: true,
    displayOrder: 7,
    webAppPresentation: '2値化→輪郭検出をパイプラインで見せ、各輪郭の面積/矩形を重畳表示＋数値テーブル。',
  },
  {
    id: 'shape-detection',
    slug: 'shape-detection',
    nameJa: '直線・円・図形検出',
    nameEn: 'Line / Circle / Template Detection',
    description:
      'Hough 変換による直線・円検出と、テンプレートマッチングによる既知パターンの探索。',
    opencvModules: ['imgproc'],
    phase: 'phase-2',
    priority: 'A',
    isMvpCandidate: true,
    displayOrder: 8,
    webAppPresentation: '検出された直線/円を入力画像に重畳。パラメータ変更で検出数が変わる感覚を掴ませる。',
  },
  {
    id: 'histogram-analysis',
    slug: 'histogram-analysis',
    nameJa: 'ヒストグラム・画像解析',
    nameEn: 'Histogram & Image Analysis',
    description:
      'ヒストグラムの計算・可視化、均一化・CLAHE によるコントラスト改善、ヒストグラム比較・バックプロジェクション。',
    opencvModules: ['imgproc'],
    phase: 'phase-3',
    priority: 'A',
    isMvpCandidate: true,
    displayOrder: 9,
    webAppPresentation: '入力画像とヒストグラムグラフを並べ、均一化/CLAHE 前後の分布変化をチャートで提示。',
  },
  {
    id: 'geometric-transform',
    slug: 'geometric-transform',
    nameJa: '幾何変換・座標変換',
    nameEn: 'Geometric Transforms',
    description:
      '平行移動・回転・アフィン変換・透視変換（射影変換）・リマップ・画像ピラミッド。座標系の変換全般。',
    opencvModules: ['imgproc'],
    phase: 'phase-3',
    priority: 'A',
    isMvpCandidate: true,
    displayOrder: 10,
    webAppPresentation: '4点ドラッグで透視変換し、斜めの書類を正面化する「スキャン」体験を提供。',
  },
  {
    id: 'segmentation',
    slug: 'segmentation',
    nameJa: 'セグメンテーション・領域分割',
    nameEn: 'Segmentation',
    description:
      'Watershed・GrabCut・Connected Components・Flood Fill・k-means による画素のグルーピング/領域分割。',
    opencvModules: ['imgproc', 'core'],
    phase: 'phase-3',
    priority: 'B',
    isMvpCandidate: false,
    displayOrder: 11,
    webAppPresentation: 'ユーザーが前景/背景をブラシ指定 → 抽出結果を表示する対話型デモが映える。',
  },
  {
    id: 'feature-detection',
    slug: 'feature-detection',
    nameJa: '特徴点検出・特徴量マッチング',
    nameEn: 'Feature Detection & Matching',
    description:
      'コーナー検出（Harris/Shi-Tomasi）、特徴点記述子（ORB/AKAZE 等）、特徴量マッチング、ホモグラフィ推定。',
    opencvModules: ['features2d', 'calib3d'],
    phase: 'phase-6',
    priority: 'B',
    isMvpCandidate: false,
    displayOrder: 12,
    webAppPresentation: '2枚画像の対応点を線で結ぶ可視化。位置合わせ/物体認識の仕組みを直感化。',
  },
  {
    id: 'object-detection',
    slug: 'object-detection',
    nameJa: '物体検出・顔検出',
    nameEn: 'Object & Face Detection',
    description:
      'Haar/LBP カスケードによる顔・目検出、QR コード検出、DNN ベースの物体/顔検出。',
    opencvModules: ['objdetect', 'dnn'],
    phase: 'phase-5',
    priority: 'A',
    isMvpCandidate: false,
    displayOrder: 13,
    webAppPresentation: '画像/カメラ映像に検出枠を重畳。モデルファイルの読み込みも学習ポイントとして見せる。',
  },
  {
    id: 'video-tracking',
    slug: 'video-tracking',
    nameJa: '動画解析・トラッキング',
    nameEn: 'Video Analysis & Tracking',
    description:
      '背景差分・フレーム差分・オプティカルフロー・Meanshift/Camshift による動き解析と追跡。',
    opencvModules: ['video'],
    phase: 'phase-4',
    priority: 'B',
    isMvpCandidate: false,
    displayOrder: 14,
    webAppPresentation: 'Webカメラのライブ映像に動きベクトル/追跡枠を重畳。requestAnimationFrame ループで処理。',
  },
  {
    id: 'camera-calibration-3d',
    slug: 'camera-calibration-3d',
    nameJa: 'カメラキャリブレーション・3D再構成',
    nameEn: 'Camera Calibration & 3D',
    description:
      'チェスボードによるカメラキャリブレーション、歪み補正、solvePnP による姿勢推定、ステレオ視差。',
    opencvModules: ['calib3d'],
    phase: 'phase-7',
    priority: 'C',
    isMvpCandidate: false,
    displayOrder: 15,
    webAppPresentation: '複数枚のチェスボード画像から歪みパラメータを推定し、補正前後を比較。専門性が高い。',
  },
  {
    id: 'image-restoration-photo',
    slug: 'image-restoration-photo',
    nameJa: '画像修復・写真加工',
    nameEn: 'Image Restoration & Computational Photography',
    description:
      'インペインティング（傷消し）、Non-local Means ノイズ除去、ディテール強調・スタイライズ等の写真加工。',
    opencvModules: ['photo'],
    phase: 'phase-3',
    priority: 'B',
    isMvpCandidate: false,
    displayOrder: 16,
    webAppPresentation: 'ユーザーがマスクを塗った領域を消す「傷消し」体験。photo モジュールの提供有無は要調査。',
  },
  {
    id: 'image-stitching',
    slug: 'image-stitching',
    nameJa: 'パノラマ・画像合成',
    nameEn: 'Panorama & Stitching',
    description:
      '複数枚の重なり画像を特徴点マッチング＋ホモグラフィで繋ぎ、1枚のパノラマに合成する。',
    opencvModules: ['stitching', 'features2d', 'calib3d'],
    phase: 'phase-6',
    priority: 'C',
    isMvpCandidate: false,
    displayOrder: 17,
    webAppPresentation: '2〜3枚をアップロード → 合成結果を表示。Stitcher の opencv.js 提供有無は要調査。',
  },
  {
    id: 'machine-learning',
    slug: 'machine-learning',
    nameJa: '機械学習（古典）',
    nameEn: 'Classic Machine Learning',
    description:
      'OpenCV ml モジュールの SVM・kNN・決定木等と、core の k-means クラスタリング。DNN 以前の古典的学習。',
    opencvModules: ['ml', 'core'],
    phase: 'phase-7',
    priority: 'C',
    isMvpCandidate: false,
    displayOrder: 18,
    webAppPresentation: '手書き数字認識など小規模デモ向き。ml モジュールの opencv.js 提供有無は要調査。',
  },
  {
    id: 'dnn-deep-learning',
    slug: 'dnn-deep-learning',
    nameJa: 'DNN・深層学習推論',
    nameEn: 'DNN Deep Learning Inference',
    description:
      'dnn モジュールで学習済みモデルを読み込み、画像分類・物体検出・セグメンテーション・スタイル変換などの推論を行う。',
    opencvModules: ['dnn'],
    phase: 'phase-7',
    priority: 'B',
    isMvpCandidate: false,
    displayOrder: 19,
    webAppPresentation: 'モデル読み込み→推論→結果重畳。モデルサイズ・性能・WASM 制約への配慮が必須。',
  },
  {
    id: 'io-ui-browser',
    slug: 'io-ui-browser',
    nameJa: '入出力・UI・ブラウザ連携',
    nameEn: 'I/O, UI & Browser Integration',
    description:
      'canvas/Image との相互変換、画像アップロード、Webカメラ取得、Canvas 描画入力、Before/After 比較など、ブラウザ固有の入出力基盤。',
    opencvModules: ['js', 'core', 'imgcodecs'],
    phase: 'phase-1',
    priority: 'S',
    isMvpCandidate: true,
    displayOrder: 20,
    webAppPresentation: 'デモ機能そのものというより全デモの土台。アップロード/サンプル選択/比較UIを共通部品化。',
  },
];

/** id 引きユーティリティ。 */
export const getCategoryById = (id: string): OpenCvCategory | undefined =>
  openCvCategories.find((c) => c.id === id);

export default openCvCategories;
