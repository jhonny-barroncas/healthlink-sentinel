export type DiagnosticTargetCandidate = {
  equipment_id: string;
  unit_id: string;
  management_address?: string | null;
};

export function chooseDiagnosticTarget(items: DiagnosticTargetCandidate[], unitId: string, preferredId?: string | null): DiagnosticTargetCandidate | null {
  const unitItems = items.filter((item) => item.unit_id === unitId);
  const addressed = unitItems.filter((item) => Boolean(item.management_address?.trim()));
  if (preferredId) {
    const preferred = addressed.find((item) => item.equipment_id === preferredId);
    if (preferred) return preferred;
  }
  return addressed[0] ?? null;
}
