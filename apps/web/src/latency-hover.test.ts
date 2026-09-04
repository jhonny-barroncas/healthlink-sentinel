import { describe, expect, it } from 'vitest';
import { nearestLatencyIndex } from './latency-hover.js';

describe('latency chart x-axis hover', () => {
  it('selects the nearest sample from horizontal position regardless of y', () => {
    expect(nearestLatencyIndex(0, 680, 9)).toBe(0);
    expect(nearestLatencyIndex(340, 680, 9)).toBe(4);
    expect(nearestLatencyIndex(680, 680, 9)).toBe(8);
  });
});
