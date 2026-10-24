export interface LatencyStats {
  lastMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  sampleCount: number;
}
