export type UnitTelemetryItem = { unit_id: string; equipment_id: string };

export function groupTelemetryByUnit<T extends UnitTelemetryItem>(items: T[]): Map<string, T[]> {
  return items.reduce((groups, item) => {
    const current = groups.get(item.unit_id) ?? [];
    current.push(item);
    groups.set(item.unit_id, current);
    return groups;
  }, new Map<string, T[]>());
}
