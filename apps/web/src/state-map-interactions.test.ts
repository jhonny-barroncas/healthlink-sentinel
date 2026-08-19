import { describe, expect, it } from 'vitest';
import { hasUnitAssets, selectMapAsset } from './state-map-interactions.js';

describe('state map asset interactions', () => {
  it('keeps the exact link clicked as the command target', () => {
    expect(selectMapAsset('unit-manaus', 'link-2')).toEqual({ unitId: 'unit-manaus', equipmentId: 'link-2' });
  });

  it('identifies an empty unit so the UI can offer equipment registration', () => {
    expect(hasUnitAssets('unit-empty', [], [])).toBe(false);
    expect(hasUnitAssets('unit-filled', [{ unit_id: 'unit-filled', equipment_id: 'equipment-1' }], [])).toBe(true);
    expect(hasUnitAssets('unit-filled', [], [{ unit_id: 'unit-filled', equipment_id: 'link-1' }])).toBe(true);
  });
});
