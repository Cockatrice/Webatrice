const COLOR_SCALE_MS = 500;
const MIN_SCALE_MS = 100;

export function latencyBarColor(ms: number): string {
  const ratio = Math.min(1, Math.max(0, ms / COLOR_SCALE_MS));
  return `hsl(${Math.round(120 * (1 - ratio))}, 100%, 50%)`;
}

export function sparklinePoints(samplesMs: readonly number[], width: number, height: number): string {
  if (samplesMs.length === 0) {
    return '';
  }
  const series = samplesMs.length === 1 ? [samplesMs[0], samplesMs[0]] : samplesMs;
  const scaleMs = Math.max(MIN_SCALE_MS, ...series);
  const step = width / (series.length - 1);
  const round = (n: number) => Math.round(n * 10) / 10;
  const y = (ms: number) => height - 1 - Math.min(1, Math.max(0, ms / scaleMs)) * (height - 2);
  return series.map((ms, i) => `${round(i * step)},${round(y(ms))}`).join(' ');
}

interface LatencyGraphProps {
  samplesMs: readonly number[];
  width: number;
  height: number;
}

export function LatencySparkline({ samplesMs, width, height, className }: LatencyGraphProps & { className?: string }) {
  if (samplesMs.length === 0) {
    return null;
  }
  return (
    <svg width={width} height={height} aria-hidden="true" data-testid="latency-sparkline" className={className}>
      <polyline
        points={sparklinePoints(samplesMs, width, height)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LatencyGraph({ samplesMs, width, height }: LatencyGraphProps) {
  if (samplesMs.length === 0) {
    return null;
  }
  const scaleMs = Math.max(MIN_SCALE_MS, ...samplesMs);
  const barWidth = width / samplesMs.length;
  return (
    <svg width={width} height={height} aria-hidden="true" data-testid="latency-graph">
      {samplesMs.map((ms, i) => {
        const barHeight = Math.min(1, Math.max(0, ms / scaleMs)) * height;
        return (
          <rect
            key={i}
            x={i * barWidth + 1}
            y={height - barHeight}
            width={Math.max(1, barWidth - 2)}
            height={barHeight}
            fill={latencyBarColor(ms)}
          />
        );
      })}
    </svg>
  );
}
