import { createHash } from 'node:crypto';
import { chmod, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AgentConfig } from './config.js';
import type { HealthLinkAuth } from './healthlink-auth.js';

export type AgentRelease = { id: string; version: string; platform: 'windows' | 'linux'; file_name: string; checksum_sha256: string; active: boolean };

export function isNewerVersion(current: string, candidate: string): boolean {
  const left = current.split('.').map(Number); const right = candidate.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((right[index] ?? 0) > (left[index] ?? 0)) return true;
    if ((right[index] ?? 0) < (left[index] ?? 0)) return false;
  }
  return false;
}

export async function checkForAgentUpdate(config: AgentConfig, auth: HealthLinkAuth): Promise<boolean> {
  const response = await auth.fetch(`${config.apiUrl}/v1/integrations/zabbix/agent-versions`, { signal: AbortSignal.timeout(config.timeoutMs) });
  if (!response.ok) throw new Error(`Não foi possível consultar versões do agente (HTTP ${response.status}).`);
  const releases = await response.json() as AgentRelease[];
  const release = releases.filter((item) => item.active && item.platform === config.platform && isNewerVersion(config.agentVersion, item.version)).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  if (!release) return false;
  const artifactResponse = await auth.fetch(`${config.apiUrl}/v1/integrations/zabbix/agent-versions/${release.id}/download`, { signal: AbortSignal.timeout(config.timeoutMs) });
  if (!artifactResponse.ok) throw new Error(`Não foi possível baixar a versão ${release.version} (HTTP ${artifactResponse.status}).`);
  const artifact = Buffer.from(await artifactResponse.arrayBuffer());
  const checksum = createHash('sha256').update(artifact).digest('hex');
  if (checksum !== release.checksum_sha256) throw new Error(`Checksum inválido para a versão ${release.version}; atualização cancelada.`);
  const temporary = `${config.agentPath}.update-${process.pid}`;
  await writeFile(temporary, artifact, { mode: 0o755 });
  if (config.platform === 'linux') await chmod(temporary, 0o755);
  await rename(temporary, config.agentPath);
  console.log(`[starlink-agent] agente atualizado para ${release.version}; reinicie o serviço para carregar o binário novo.`);
  return true;
}
