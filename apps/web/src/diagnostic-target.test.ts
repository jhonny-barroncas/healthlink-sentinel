import { describe, expect, it } from 'vitest';
import { chooseDiagnosticTarget } from './diagnostic-target.js';

describe('diagnostic target selection', () => {
  const items = [
    { equipment_id: 'server-1', unit_id: 'unit-1', management_address: null },
    { equipment_id: 'link-1', unit_id: 'unit-1', management_address: '192.168.1.1' },
    { equipment_id: 'other-1', unit_id: 'unit-2', management_address: '10.0.0.1' },
    { equipment_id: 'server-2', unit_id: 'unit-3', management_address: null },
  ];

  it('chooses the preferred addressed equipment and never crosses units', () => {
    expect(chooseDiagnosticTarget(items, 'unit-1', 'link-1')?.equipment_id).toBe('link-1');
    expect(chooseDiagnosticTarget(items, 'unit-1', 'other-1')?.equipment_id).toBe('link-1');
  });

  it('returns no target when the unit has no management address', () => {
    expect(chooseDiagnosticTarget(items, 'unit-3')).toBeNull();
    expect(chooseDiagnosticTarget(items, 'missing')).toBeNull();
  });
});
