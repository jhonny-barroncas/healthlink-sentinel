export type MapAssetRef = { unit_id: string; equipment_id: string };

export function selectMapAsset(unitId: string, equipmentId: string): MapAssetRef {
  return { unitId, equipmentId };
}

export function hasUnitAssets(unitId: string, equipment: MapAssetRef[], telemetry: MapAssetRef[]): boolean {
  return equipment.some((item) => item.unit_id === unitId) || telemetry.some((item) => item.unit_id === unitId);
}
