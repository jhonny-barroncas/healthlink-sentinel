import { describe, expect, it } from 'vitest';
import { reconcileStarlinkIncidents, type StarlinkIncidentState } from './incidents.js';

describe('reconcileStarlinkIncidents', () => {
  it('opens a new alert and keeps an already open alert without duplicating it', () => {
    const current: StarlinkIncidentState[] = [
      { key: 'thermal_throttle', title: 'Thermal throttle', severity: 3, status: 'open' },
    ];

    expect(reconcileStarlinkIncidents(current, [
      { key: 'thermal_throttle', title: 'Thermal throttle', severity: 3 },
      { key: 'motors_stuck', title: 'Motors stuck', severity: 4 },
    ])).toEqual({
      opened: [{ key: 'motors_stuck', title: 'Motors stuck', severity: 4 }],
      recovered: [],
      unchanged: ['thermal_throttle'],
    });
  });

  it('recovers an incident that is no longer active', () => {
    const current: StarlinkIncidentState[] = [
      { key: 'thermal_throttle', title: 'Thermal throttle', severity: 3, status: 'open' },
      { key: 'motors_stuck', title: 'Motors stuck', severity: 4, status: 'acknowledged' },
    ];

    expect(reconcileStarlinkIncidents(current, [])).toEqual({
      opened: [],
      recovered: ['thermal_throttle', 'motors_stuck'],
      unchanged: [],
    });
  });
});
