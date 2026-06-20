/**
 * Chart payloads produced by `chart`-output demos (e.g. histogram-calculation).
 *
 * Lives in its own module (importing nothing) so both the worker side
 * (processors.ts) and the main-thread client (cvClient.ts) can share the type
 * without creating a circular import through the worker entry.
 */

export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

export interface ChartData {
  type: 'histogram';
  bins: number;
  /** Inclusive max of the value axis (e.g. 255 for 8-bit pixel values). */
  range: number;
  series: ChartSeries[];
  xLabel?: string;
  yLabel?: string;
}
