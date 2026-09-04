import { describe, expect, it } from 'vitest';
import { buildPingSparkline } from './ping-sparkline.js';

describe('ping sparkline', () => {
  it('places higher latency proportionally higher on a stable 250 ms scale', () => {
    const result = buildPingSparkline([20, 100, 220]);

    expect(result.points).toEqual([
      { x: 0, y: 24.24 },
      { x: 43, y: 17.2 },
      { x: 86, y: 6.64 },
    ]);
    expect(result.last).toEqual({ x: 86, y: 6.64 });
  });

  it('keeps invalid and negative readings at the baseline and caps extreme latency', () => {
    expect(buildPingSparkline([Number.NaN, -20, 500]).points).toEqual([
      { x: 0, y: 26 },
      { x: 43, y: 26 },
      { x: 86, y: 4 },
    ]);
  });
});
