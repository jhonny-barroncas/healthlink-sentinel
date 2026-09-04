export type PingSparklinePoint = { x: number; y: number };

export function buildPingSparkline(values: number[], width = 86, height = 30, ceilingMs = 250): { points: PingSparklinePoint[]; last: PingSparklinePoint } {
  const series = values.length > 1 ? values : [0, 0];
  const usableWidth = width;
  const top = 4;
  const baseline = height - 4;
  const usableHeight = baseline - top;
  const points = series.map((rawValue, index) => {
    const value = Number.isFinite(rawValue) ? Math.max(0, Math.min(ceilingMs, rawValue)) : 0;
    return {
      x: Number(((index / (series.length - 1)) * usableWidth).toFixed(2)),
      y: Number((baseline - (value / ceilingMs) * usableHeight).toFixed(2)),
    };
  });
  return { points, last: points[points.length - 1] };
}
