/** A distinct accent per category, used for cards and section headers. */
const palette: Record<string, string> = {
  'image-basics': '#7c5cff',
  'color-conversion': '#ff4d6d',
  'filtering-denoising': '#22d3ee',
  thresholding: '#34e0a1',
  morphology: '#f5a524',
  'edge-gradient': '#4d9dff',
  'contours-shape': '#b56bff',
  'shape-detection': '#2dd4bf',
  'histogram-analysis': '#f97384',
  'geometric-transform': '#60a5fa',
  segmentation: '#a3e635',
  'feature-detection': '#e879f9',
  'object-detection': '#fb923c',
  'video-tracking': '#38bdf8',
  'camera-calibration-3d': '#94a3b8',
  'image-restoration-photo': '#f472b6',
  'image-stitching': '#818cf8',
  'machine-learning': '#facc15',
  'dnn-deep-learning': '#34e0a1',
  'io-ui-browser': '#9aa4b8',
  recipes: '#fbbf24',
};

export function categoryAccent(categoryId: string): string {
  return palette[categoryId] ?? '#7c5cff';
}
