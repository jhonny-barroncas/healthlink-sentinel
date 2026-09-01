export type AgentStatus = 'online' | 'offline' | 'pending' | 'unlinked';

export type AgentRecord = {
  unitId: string;
  unitCode: string;
  unitName: string;
  city: string;
  stateCode: string;
  equipmentName: string | null;
  version: string | null;
  observedAt: string | null;
  status: AgentStatus;
};

// A API (`GET /v1/monitoring/agents`) devolve as linhas do Postgres em snake_case
// (`unit_id`, `unit_code`, `state_code`…). O `api()` do frontend não transforma
// chaves, então normalizamos aqui para o formato camelCase do `AgentRecord`.
// Também tolera payloads que já venham em camelCase.
export function normalizeAgentRecord(row: Record<string, unknown>): AgentRecord {
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined) return value;
    }
    return undefined;
  };
  const str = (value: unknown): string => (value == null ? '' : String(value));
  const nullableStr = (value: unknown): string | null => (value == null ? null : String(value));
  const status = str(pick('status')) as AgentStatus;
  return {
    unitId: str(pick('unitId', 'unit_id')),
    unitCode: str(pick('unitCode', 'unit_code')),
    unitName: str(pick('unitName', 'unit_name')),
    city: str(pick('city')),
    stateCode: str(pick('stateCode', 'state_code')),
    equipmentName: nullableStr(pick('equipmentName', 'equipment_name')),
    version: nullableStr(pick('version')),
    observedAt: nullableStr(pick('observedAt', 'observed_at')),
    status: (['online', 'offline', 'pending', 'unlinked'] as const).includes(status) ? status : 'unlinked',
  };
}

export function agentStatusFromObservedAt(observedAt: string | null, now = Date.now(), freshnessMs = 30_000): AgentStatus {
  if (!observedAt) return 'unlinked';
  const age = now - new Date(observedAt).getTime();
  return Number.isFinite(age) && age <= freshnessMs ? 'online' : 'offline';
}

export function agentStatusLabel(status: AgentStatus): string {
  return status === 'online' ? 'Agente em execução' : status === 'offline' ? 'Agente parado' : status === 'pending' ? 'Aguardando instalação' : 'Sem agente vinculado';
}
