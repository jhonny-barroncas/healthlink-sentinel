export type MapAssetRef = { unit_id: string; equipment_id: string };
type MapUnitRef = { unit_id: string; code: string; operational_status: 'online' | 'degraded' | 'offline' | 'unknown' };
type MapAlertRef = { unit_id?: string | null; unit_code?: string; severity: number; status: string };

export function selectMapAsset(unitId: string, equipmentId: string): MapAssetRef {
  return { unit_id: unitId, equipment_id: equipmentId };
}

export function hasUnitAssets(unitId: string, equipment: MapAssetRef[], telemetry: MapAssetRef[]): boolean {
  return equipment.some((item) => item.unit_id === unitId) || telemetry.some((item) => item.unit_id === unitId);
}

export function getUnitMapMenuAvailability(unitId: string, telemetry: MapAssetRef[]): { telemetryEquipmentId: string | null; telemetryAvailable: boolean } {
  const telemetryEquipmentId = telemetry.find((item) => item.unit_id === unitId)?.equipment_id ?? null;
  return { telemetryEquipmentId, telemetryAvailable: telemetryEquipmentId !== null };
}

export function getUnitInventoryView(unitType: 'fixed' | 'mobile'): 'fixed-units' | 'mobile-units' {
  return unitType === 'fixed' ? 'fixed-units' : 'mobile-units';
}

export function getUnitMapAlertState(unit: MapUnitRef, alerts: MapAlertRef[]): { alertCount: number; tone: MapUnitRef['operational_status'] | 'attention' | 'critical' } {
  const activeAlerts = alerts.filter((alert) => alert.status !== 'resolved' && (alert.unit_id === unit.unit_id || alert.unit_code === unit.code) && alert.severity >= 2);
  const highestSeverity = activeAlerts.reduce((highest, alert) => Math.max(highest, alert.severity), 0);
  return { alertCount: activeAlerts.length, tone: highestSeverity >= 4 ? 'critical' : highestSeverity >= 2 ? 'attention' : unit.operational_status };
}
