import { describe, expect, it } from 'vitest';
import { filterIncidentReports, summarizeIncidentReports, type IncidentReportAlert } from './incident-reports.js';

const alerts: IncidentReportAlert[] = [
  { id: '1', title: 'Link indisponível', severity: 5, status: 'open', unit_code: 'UM-01', unit_id: 'u1', opened_at: '2026-08-20T10:00:00.000Z', resolved_at: null },
  { id: '2', title: 'Latência elevada', severity: 3, status: 'acknowledged', unit_code: 'UF-01', unit_id: 'u2', opened_at: '2026-08-21T10:00:00.000Z', resolved_at: null },
  { id: '3', title: 'Servidor recuperado', severity: 2, status: 'resolved', unit_code: 'UM-01', unit_id: 'u1', opened_at: '2026-08-19T10:00:00.000Z', resolved_at: '2026-08-19T11:30:00.000Z' },
];

describe('incident reports', () => {
  it('filters by status, severity, unit and period', () => {
    const result = filterIncidentReports(alerts, {
      status: 'open',
      severity: 'critical',
      unitId: 'u1',
      from: '2026-08-20',
      to: '2026-08-20',
    });

    expect(result.map((alert) => alert.id)).toEqual(['1']);
  });

  it('summarizes operational incident counts and average resolution time', () => {
    expect(summarizeIncidentReports(alerts)).toEqual({ total: 3, open: 1, acknowledged: 1, resolved: 1, critical: 1, averageResolutionMinutes: 90 });
  });
});
