import type { LatencyStats } from '../types/LatencyStats';

export const LATENCY_WINDOW_SIZE = 64;

const EMPTY_STATS: LatencyStats = { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 };

export class LatencyTracker {
  private samples = new Array<number>(LATENCY_WINDOW_SIZE).fill(0);
  private head = 0;
  private count = 0;

  addSample(ms: number): void {
    this.samples[this.head] = ms;
    this.head = (this.head + 1) % LATENCY_WINDOW_SIZE;
    if (this.count < LATENCY_WINDOW_SIZE) {
      this.count++;
    }
  }

  recentSamples(): number[] {
    const result: number[] = [];
    for (let i = this.count; i > 0; i--) {
      result.push(this.samples[(this.head + LATENCY_WINDOW_SIZE - i) % LATENCY_WINDOW_SIZE]);
    }
    return result;
  }

  stats(): LatencyStats {
    const n = this.count;
    if (n === 0) {
      return { ...EMPTY_STATS };
    }
    const sorted = this.samples.slice(0, n).sort((a, b) => a - b);
    const medianMs = n % 2 === 1
      ? sorted[(n - 1) / 2]
      : Math.trunc((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
    const p95Ms = sorted[Math.max(0, Math.ceil(0.95 * n) - 1)];
    return {
      lastMs: this.samples[(this.head + LATENCY_WINDOW_SIZE - 1) % LATENCY_WINDOW_SIZE],
      medianMs,
      p95Ms,
      maxMs: sorted[n - 1],
      sampleCount: n,
    };
  }

  clear(): void {
    this.samples.fill(0);
    this.head = 0;
    this.count = 0;
  }
}
