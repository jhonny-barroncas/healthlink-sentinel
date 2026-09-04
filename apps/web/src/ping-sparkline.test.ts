import { describe, expect, it } from 'vitest';
import { buildPingSparkline } from './ping-sparkline.js';

describe('ping sparkline', () => {
  it('uses the recent telemetry range so sub-millisecond changes remain visible', () => {
    const result = buildPingSparkline([0.3, 0.55, 0.2]);

    expect(result.points).toEqual([
      { x: 0, y: 19.71 },
      { x: 43, y: 4 },
      { x: 86, y: 26 },
    ]);
  });

  it('places higher latency above lower latency without changing chart dimensions', () => {
    const result = buildPingSparkline([20, 100, 220]);

    expect(result.points).toEqual([
      { x: 0, y: 26 },
      { x: 43, y: 17.2 },
      { x: 86, y: 4 },
    ]);
    expect(result.last).toEqual({ x: 86, y: 4 });
  });

  it('keeps invalid and negative readings at the baseline while preserving a visible spike', () => {
    expect(buildPingSparkline([Number.NaN, -20, 500]).points).toEqual([
      { x: 0, y: 26 },
      { x: 43, y: 26 },
      { x: 86, y: 4 },
    ]);
  });
});
