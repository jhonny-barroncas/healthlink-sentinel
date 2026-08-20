import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const assignmentSchema = z.object({
  equipmentId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['starlink', 'mikrotik', 'internet_link']),
  managementAddress: z.string().nullable(),
});

const enrollmentResponseSchema = z.object({
  agentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  unitId: z.string().uuid(),
  serverEquipmentId: z.string().uuid(),
  platform: z.enum(['windows', 'linux']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  credential: z.string().min(20),
  assignments: z.array(assignmentSchema),
});

const installedConfigSchema = enrollmentResponseSchema.extend({
  apiUrl: z.string().url(),
  queuePath: z.string().min(1),
  dataDir: z.string().min(1),
  agentPath: z.string().min(1),
  configPath: z.string().min(1),
  pollIntervalMs: z.number().int().min(5_000).default(15_000),
  timeoutMs: z.number().int().min(500).default(3_000),
});

export type InstalledAgentConfig = z.infer<typeof installedConfigSchema>;

export type EnrollmentInstallOptions = {
  apiUrl: string;
  enrollmentToken: string;
  configPath: string;
  dataDir: string;
  agentPath: string;
};

async function responseError(response: Response): Promise<Error> {
  let message = `A API recusou o enrollment (HTTP ${response.status}).`;
  try {
    const body = await response.json() as { message?: unknown; error?: unknown };
    const detail = body.message ?? body.error;
    if (typeof detail === 'string' && detail.trim()) message = detail.trim().slice(0, 300);
  } catch {
    // Preserve the sanitized HTTP error when the response is not JSON.
  }
  return new Error(message);
}

export async function enrollAndSave(options: EnrollmentInstallOptions, fetcher: typeof fetch = globalThis.fetch): Promise<InstalledAgentConfig> {
  const apiUrl = options.apiUrl.replace(/\/+$/, '');
  const response = await fetcher(`${apiUrl}/v1/collection-agents/enroll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: options.enrollmentToken }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw await responseError(response);
  const enrolled = enrollmentResponseSchema.parse(await response.json());
  const installed = installedConfigSchema.parse({
    ...enrolled,
    apiUrl,
    queuePath: join(options.dataDir, 'queue.json'),
    dataDir: options.dataDir,
    agentPath: options.agentPath,
    configPath: options.configPath,
    pollIntervalMs: 15_000,
    timeoutMs: 3_000,
  });
  await writeFile(options.configPath, `${JSON.stringify(installed, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return installed;
}

export async function loadInstalledAgentConfig(path: string): Promise<InstalledAgentConfig> {
  return installedConfigSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

