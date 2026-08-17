export const permission = {
  tenantManage: 'tenant.manage',
  usersManage: 'users.manage',
  unitsRead: 'units.read',
  unitsManage: 'units.manage',
  monitoringRead: 'monitoring.read',
  alertsRead: 'alerts.read',
  alertsAcknowledge: 'alerts.acknowledge',
  reportsRead: 'reports.read',
  auditRead: 'audit.read',
  integrationsManage: 'integrations.manage',
} as const;

export type Permission = (typeof permission)[keyof typeof permission];

export const systemRoles: Record<string, Permission[]> = {
  global_administrator: Object.values(permission),
  tenant_administrator: [permission.usersManage, permission.unitsRead, permission.unitsManage, permission.monitoringRead, permission.alertsRead, permission.alertsAcknowledge, permission.reportsRead, permission.auditRead, permission.integrationsManage],
  supervisor: [permission.unitsRead, permission.monitoringRead, permission.alertsRead, permission.alertsAcknowledge, permission.reportsRead],
  noc_operator: [permission.unitsRead, permission.monitoringRead, permission.alertsRead, permission.alertsAcknowledge],
  viewer: [permission.unitsRead, permission.monitoringRead, permission.alertsRead, permission.reportsRead],
  service_agent: [permission.integrationsManage],
};

export function hasPermission(roles: string[], required: Permission): boolean {
  return roles.some((role) => systemRoles[role]?.includes(required));
}
