export type PingSparklinePoint = { x: number; y: number };

export function buildPingSparkline(values: number[], width = 86, height = 30, ceilingMs = 250): { points: PingSparklinePoint[]; last: PingSparklinePoint } {
  const series = values.length > 1 ? values : [0, 0];
  const usableWidth = width;
  const top = 4;
  const baseline = height - 4;
  const usableHeight = baseline - top;
  const normalized = series.map((rawValue) => Number.isFinite(rawValue) ? Math.max(0, Math.min(ceilingMs, rawValue)) : 0);
  const minimum = Math.min(...normalized);
  const maximum = Math.max(...normalized);
  const range = maximum - minimum;
  const points = normalized.map((value, index) => {
    return {
      x: Number(((index / (series.length - 1)) * usableWidth).toFixed(2)),
      y: Number((range === 0 ? baseline : baseline - ((value - minimum) / range) * usableHeight).toFixed(2)),
    };
  });
  return { points, last: points[points.length - 1] };
}
