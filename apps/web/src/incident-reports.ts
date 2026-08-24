export type IncidentReportAlert = {
  id: string;
  title: string;
  severity: number;
  status: string;
  unit_id?: string | null;
  unit_code?: string;
  equipment_name?: string;
  opened_at: string;
  resolved_at?: string | null;
};

export type IncidentReportFilters = {
  status: 'all' | 'open' | 'acknowledged' | 'resolved';
  severity: 'all' | 'critical' | 'high' | 'medium' | 'low';
  unitId: string;
  from: string;
  to: string;
};

function severityMatches(severity: number, filter: IncidentReportFilters['severity']) {
  if (filter === 'all') return true;
  if (filter === 'critical') return severity >= 5;
  if (filter === 'high') return severity === 4;
  if (filter === 'medium') return severity >= 2 && severity <= 3;
  return severity <= 1;
}

export function filterIncidentReports(alerts: IncidentReportAlert[], filters: IncidentReportFilters) {
  const fromTime = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  return alerts.filter((alert) => {
    const openedAt = new Date(alert.opened_at).getTime();
    return (filters.status === 'all' || alert.status === filters.status)
      && severityMatches(alert.severity, filters.severity)
      && (!filters.unitId || alert.unit_id === filters.unitId)
      && openedAt >= fromTime
      && openedAt <= toTime;
  });
}

export function summarizeIncidentReports(alerts: IncidentReportAlert[]) {
  const resolved = alerts.filter((alert) => alert.status === 'resolved' && alert.resolved_at);
  const totalResolutionMinutes = resolved.reduce((total, alert) => total + Math.max(0, new Date(alert.resolved_at as string).getTime() - new Date(alert.opened_at).getTime()) / 60000, 0);
  return {
    total: alerts.length,
    open: alerts.filter((alert) => alert.status === 'open').length,
    acknowledged: alerts.filter((alert) => alert.status === 'acknowledged').length,
    resolved: resolved.length,
    critical: alerts.filter((alert) => alert.severity >= 5).length,
    averageResolutionMinutes: resolved.length ? Math.round(totalResolutionMinutes / resolved.length) : 0,
  };
}
