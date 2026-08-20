import { basename, dirname, extname, join } from 'node:path';
import type { AgentConfig } from './config.js';

function queuePathFor(queuePath: string, equipmentId: string): string {
  const extension = extname(queuePath);
  const stem = basename(queuePath, extension);
  const safeId = equipmentId.replace(/[^a-zA-Z0-9-]/g, '-');
  return join(dirname(queuePath), `${stem}-${safeId}${extension || '.json'}`);
}

export function starlinkTargets(config: AgentConfig): AgentConfig[] {
  return config.assignments.filter((item) => item.type === 'starlink').map((item) => ({
    ...config,
    equipmentId: item.equipmentId,
    starlinkHost: item.managementAddress || '192.168.100.1',
    queuePath: queuePathFor(config.queuePath, item.equipmentId),
  }));
}

