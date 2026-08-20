export type AgentProvisioningEquipment = {
  equipment_id: string;
  equipment_type: string;
  active?: boolean;
};

export type AgentInstallerPlatform = 'windows' | 'linux';

const serverTypes = new Set(['server', 'linux_server']);
const sourceTypes = new Set(['starlink', 'mikrotik', 'internet_link']);

export function getAgentProvisioningRequirements(equipment: AgentProvisioningEquipment[]) {
  const active = equipment.filter((item) => item.active !== false);
  const servers = active.filter((item) => serverTypes.has(item.equipment_type));
  const sources = active.filter((item) => sourceTypes.has(item.equipment_type));
  const missingMessages: string[] = [];
  if (servers.length === 0) missingMessages.push('Cadastre um equipamento do tipo Servidor nesta unidade.');
  if (sources.length === 0) missingMessages.push('Cadastre uma Starlink, um MikroTik ou um link de internet ativo nesta unidade.');
  return { servers, sources, missingMessages };
}

export function agentInstallerFileName(unitCode: string, platform: AgentInstallerPlatform): string {
  const slug = unitCode.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unidade';
  return `healthlink-agent-${slug}-${platform}.${platform === 'windows' ? 'ps1' : 'sh'}`;
}

export function extractAgentInstallerFileName(contentDisposition: string | null, fallback: string): string {
  const match = contentDisposition?.match(/filename\s*=\s*"?([^";]+)"?/i);
  const fileName = match?.[1]?.trim();
  return fileName && /^[a-z0-9][a-z0-9._-]*\.(ps1|sh)$/i.test(fileName) ? fileName : fallback;
}
