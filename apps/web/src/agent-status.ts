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

export function agentStatusFromObservedAt(observedAt: string | null, now = Date.now(), freshnessMs = 30_000): AgentStatus {
  if (!observedAt) return 'unlinked';
  const age = now - new Date(observedAt).getTime();
  return Number.isFinite(age) && age <= freshnessMs ? 'online' : 'offline';
}

export function agentStatusLabel(status: AgentStatus): string {
  return status === 'online' ? 'Agente em execução' : status === 'offline' ? 'Agente parado' : status === 'pending' ? 'Aguardando instalação' : 'Sem agente vinculado';
}
