import 'dotenv/config';
import type { InstalledAgentConfig } from './installed-config.js';

declare const __HEALTHLINK_AGENT_VERSION__: string;

export function bundledAgentVersion(fallback = '1.0.0'): string {
  return typeof __HEALTHLINK_AGENT_VERSION__ === 'string' ? __HEALTHLINK_AGENT_VERSION__ : fallback;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} é obrigatório para o agente Starlink.`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function numberEnv(name: string, fallback: number, minimum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${name} deve ser um número maior ou igual a ${minimum}.`);
  return value;
}

export type AgentConfig = {
  apiUrl: string;
  apiToken?: string;
  apiEmail?: string;
  apiPassword?: string;
  tenantId?: string;
  equipmentId: string;
  starlinkHost: string;
  starlinkPort: number;
  pollIntervalMs: number;
  timeoutMs: number;
  queuePath: string;
  platform: 'windows' | 'linux';
  agentVersion: string;
  agentPath: string;
  configPath?: string;
  dataDir?: string;
  agentId?: string;
  unitId?: string;
  serverEquipmentId?: string;
  assignments: InstalledAgentConfig['assignments'];
};

export function agentConfigFromInstalled(installed: InstalledAgentConfig, bundledVersion = installed.version): AgentConfig {
  const starlink = installed.assignments.find((item) => item.type === 'starlink');
  return {
    apiUrl: installed.apiUrl,
    apiToken: installed.credential,
    tenantId: installed.tenantId,
    equipmentId: starlink?.equipmentId ?? installed.serverEquipmentId,
    starlinkHost: starlink?.managementAddress || '192.168.100.1',
    starlinkPort: 9200,
    pollIntervalMs: installed.pollIntervalMs,
    timeoutMs: installed.timeoutMs,
    queuePath: installed.queuePath,
    platform: installed.platform,
    agentVersion: bundledVersion,
    agentPath: installed.agentPath,
    configPath: installed.configPath,
    dataDir: installed.dataDir,
    agentId: installed.agentId,
    unitId: installed.unitId,
    serverEquipmentId: installed.serverEquipmentId,
    assignments: installed.assignments,
  };
}

export function loadConfig(): AgentConfig {
  const apiToken = optional('HEALTHLINK_API_TOKEN');
  const apiEmail = optional('HEALTHLINK_API_EMAIL');
  const apiPassword = optional('HEALTHLINK_API_PASSWORD');
  if (!apiToken && (!apiEmail || !apiPassword)) {
    throw new Error('Configure HEALTHLINK_API_TOKEN ou HEALTHLINK_API_EMAIL + HEALTHLINK_API_PASSWORD para o agente Starlink.');
  }
  return {
    apiUrl: required('HEALTHLINK_API_URL').replace(/\/$/, ''),
    apiToken,
    apiEmail,
    apiPassword,
    tenantId: optional('HEALTHLINK_TENANT_ID'),
    equipmentId: required('HEALTHLINK_EQUIPMENT_ID'),
    starlinkHost: process.env.STARLINK_HOST?.trim() || '192.168.100.1',
    starlinkPort: numberEnv('STARLINK_PORT', 9200, 1),
    pollIntervalMs: numberEnv('STARLINK_POLL_INTERVAL_MS', 15_000, 5_000),
    timeoutMs: numberEnv('STARLINK_TIMEOUT_MS', 3_000, 500),
    queuePath: process.env.STARLINK_QUEUE_PATH?.trim() || '.healthlink-starlink-queue.json',
    platform: process.env.HEALTHLINK_AGENT_PLATFORM === 'windows' ? 'windows' : 'linux',
    agentVersion: process.env.HEALTHLINK_AGENT_VERSION?.trim() || '1.0.0',
    agentPath: process.env.HEALTHLINK_AGENT_PATH?.trim() || process.argv[1],
    assignments: [{ equipmentId: required('HEALTHLINK_EQUIPMENT_ID'), name: 'Starlink', type: 'starlink', managementAddress: process.env.STARLINK_HOST?.trim() || '192.168.100.1' }],
  };
}
