import { createHash, randomBytes } from 'node:crypto';

export const AGENT_SERVER_TYPES = ['server', 'linux_server'] as const;
export const AGENT_SOURCE_TYPES = ['starlink', 'mikrotik', 'internet_link'] as const;

export type AgentPlatform = 'windows' | 'linux';

export type ProvisioningEquipment = { id: string; type: string; active: boolean };

export function evaluateAgentRequirements(equipment: ProvisioningEquipment[]) {
  const active = equipment.filter((item) => item.active);
  const servers = active.filter((item) => AGENT_SERVER_TYPES.includes(item.type as (typeof AGENT_SERVER_TYPES)[number]));
  const sources = active.filter((item) => AGENT_SOURCE_TYPES.includes(item.type as (typeof AGENT_SOURCE_TYPES)[number]));
  const missing: Array<'server' | 'source'> = [];
  if (servers.length === 0) missing.push('server');
  if (sources.length === 0) missing.push('source');
  return { servers, sources, missing, eligible: missing.length === 0 };
}

const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

function createOpaqueToken(prefix: 'hle' | 'hla', tenantId: string, entityId: string) {
  const secret = randomBytes(32).toString('base64url');
  return { secret, token: `${prefix}_${tenantId}.${entityId}.${secret}` };
}

function parseOpaqueToken(token: string, prefix: 'hle' | 'hla') {
  const match = token.match(new RegExp(`^${prefix}_(${uuidPattern})\.(${uuidPattern})\.([A-Za-z0-9_-]{32,})$`, 'i'));
  return match ? { tenantId: match[1].toLowerCase(), entityId: match[2].toLowerCase(), secret: match[3] } : null;
}

export function createEnrollmentToken(tenantId: string, enrollmentId: string) {
  return createOpaqueToken('hle', tenantId, enrollmentId);
}

export function parseEnrollmentToken(token: string) {
  const parsed = parseOpaqueToken(token, 'hle');
  return parsed ? { tenantId: parsed.tenantId, enrollmentId: parsed.entityId, secret: parsed.secret } : null;
}

export function createAgentCredential(tenantId: string, agentId: string) {
  return createOpaqueToken('hla', tenantId, agentId);
}

export function parseAgentCredential(token: string) {
  const parsed = parseOpaqueToken(token, 'hla');
  return parsed ? { tenantId: parsed.tenantId, agentId: parsed.entityId, secret: parsed.secret } : null;
}

export function hashAgentSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function resolveAgentApiUrl(input: {
  configuredUrl?: string;
  requestProtocol: string;
  forwardedProtocol?: string;
  host?: string;
}): string {
  const forwardedProtocol = input.forwardedProtocol?.split(',')[0]?.trim();
  const candidate = input.configuredUrl?.trim()
    || `${forwardedProtocol || input.requestProtocol}://${input.host ?? ''}`;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error('URL pública da API inválida para o instalador.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.host || url.username || url.password || url.search || url.hash) {
    throw new Error('URL pública da API inválida para o instalador.');
  }
  return url.toString().replace(/\/$/, '');
}

export function collectionAgentInstallerFileName(unitCode: string, platform: AgentPlatform): string {
  const slug = unitCode.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unidade';
  return `healthlink-agent-${slug}-${platform}.${platform === 'windows' ? 'ps1' : 'sh'}`;
}

export function isDeployableAgentArtifact(fileName: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*\.cjs$/i.test(fileName);
}
