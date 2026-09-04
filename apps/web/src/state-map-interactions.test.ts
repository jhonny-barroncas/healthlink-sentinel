import { describe, expect, it } from 'vitest';
import { getUnitInventoryView, getUnitMapMenuAvailability, hasUnitAssets, selectMapAsset, shouldShowMapAssetKind } from './state-map-interactions.js';

describe('state map asset interactions', () => {
  it('keeps the exact link clicked as the command target', () => {
    expect(selectMapAsset('unit-manaus', 'link-2')).toEqual({ unit_id: 'unit-manaus', equipment_id: 'link-2' });
  });

  it('identifies an empty unit so the UI can offer equipment registration', () => {
    expect(hasUnitAssets('unit-empty', [], [])).toBe(false);
    expect(hasUnitAssets('unit-filled', [{ unit_id: 'unit-filled', equipment_id: 'equipment-1' }], [])).toBe(true);
    expect(hasUnitAssets('unit-filled', [], [{ unit_id: 'unit-filled', equipment_id: 'link-1' }])).toBe(true);
  });

  it('classifies the most severe active alert for a unit map marker', async () => {
    const { getUnitMapAlertState } = await import('./state-map-interactions.js');
    const unit = { unit_id: 'unit-manaus', code: 'UNI-01', operational_status: 'online' as const };
    expect(getUnitMapAlertState(unit, [
      { unit_id: 'unit-manaus', unit_code: 'UNI-01', severity: 2, status: 'open' },
      { unit_id: 'unit-manaus', unit_code: 'UNI-01', severity: 5, status: 'acknowledged' },
      { unit_id: 'unit-manaus', unit_code: 'UNI-01', severity: 5, status: 'resolved' },
    ])).toEqual({ alertCount: 2, tone: 'critical' });
  });

  it('enables telemetry action only when the unit has telemetry to open', () => {
    expect(getUnitMapMenuAvailability('unit-1', [
      { unit_id: 'unit-1', equipment_id: 'link-1' },
      { unit_id: 'unit-2', equipment_id: 'link-2' },
    ])).toEqual({ telemetryEquipmentId: 'link-1', telemetryAvailable: true });
    expect(getUnitMapMenuAvailability('unit-empty', [])).toEqual({ telemetryEquipmentId: null, telemetryAvailable: false });
  });

  it('routes map units to the inventory view matching their type', () => {
    expect(getUnitInventoryView('fixed')).toBe('fixed-units');
    expect(getUnitInventoryView('mobile')).toBe('mobile-units');
  });

  it('filters expanded map assets without mixing links and equipment', () => {
    expect(shouldShowMapAssetKind('link', 'all')).toBe(true);
    expect(shouldShowMapAssetKind('equipment', 'all')).toBe(true);
    expect(shouldShowMapAssetKind('link', 'links')).toBe(true);
    expect(shouldShowMapAssetKind('equipment', 'links')).toBe(false);
    expect(shouldShowMapAssetKind('link', 'equipment')).toBe(false);
    expect(shouldShowMapAssetKind('equipment', 'equipment')).toBe(true);
  });
});
