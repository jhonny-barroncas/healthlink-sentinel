export function nearestLatencyIndex(pointerX: number, width: number, sampleCount: number): number {
  if (sampleCount <= 1 || width <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, pointerX / width));
  return Math.max(0, Math.min(sampleCount - 1, Math.round(ratio * (sampleCount - 1))));
}
