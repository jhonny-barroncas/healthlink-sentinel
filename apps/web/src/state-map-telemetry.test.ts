import { describe, expect, it } from 'vitest';
import { groupTelemetryByUnit } from './state-map-telemetry.js';

describe('state map telemetry grouping', () => {
  it('keeps every link belonging to the same unit', () => {
    const grouped = groupTelemetryByUnit([
      { unit_id: 'unit-1', equipment_id: 'link-1' },
      { unit_id: 'unit-1', equipment_id: 'link-2' },
      { unit_id: 'unit-2', equipment_id: 'link-3' },
    ]);

    expect(grouped.get('unit-1')?.map((item) => item.equipment_id)).toEqual(['link-1', 'link-2']);
    expect(grouped.get('unit-2')?.map((item) => item.equipment_id)).toEqual(['link-3']);
  });
});
