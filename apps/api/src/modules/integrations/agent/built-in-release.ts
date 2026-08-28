import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const builtInVersion = '1.0.3';
const placeholderNames = ['healthlink-agent-1.0.3.sh', 'healthlink-agent-1.0.3.ps1'];

export function shouldReplaceBuiltInRelease(release: { version: string; fileName: string }): boolean {
  return release.version === builtInVersion && placeholderNames.includes(release.fileName);
}

export function builtInReleaseFileName(platform: 'windows' | 'linux'): string {
  return `healthlink-agent-${builtInVersion}-${platform}.cjs`;
}

export async function synchronizeBuiltInAgentRelease(): Promise<{ tenants: number; checksum: string }> {
  // Keep the release policy importable by unit tests without eagerly parsing the
  // API environment. The database is only needed when synchronization actually runs.
  const { database } = await import('../../../platform/database.js');
  const artifactPath = resolve(process.cwd(), `dist/agent/healthlink-agent-${builtInVersion}.cjs`);
  const artifact = await readFile(artifactPath);
  const checksum = createHash('sha256').update(artifact).digest('hex');
  const client = await database.connect();
  let tenants = 0;
  try {
    await client.query('BEGIN');
    for (const platform of ['windows', 'linux'] as const) {
      const result = await client.query(`
        INSERT INTO agent_versions (tenant_id, version, platform, file_name, artifact, file_size, checksum_sha256)
        SELECT t.id, $1, $2, $3, $4, $5, $6 FROM tenants t
        ON CONFLICT (tenant_id, version, platform) DO UPDATE
        SET file_name = EXCLUDED.file_name, artifact = EXCLUDED.artifact, file_size = EXCLUDED.file_size,
            checksum_sha256 = EXCLUDED.checksum_sha256, active = true, created_at = now()
        WHERE agent_versions.file_name = ANY($7::text[])
        RETURNING id
      `, [builtInVersion, platform, builtInReleaseFileName(platform), artifact, artifact.length, checksum, placeholderNames]);
      tenants = Math.max(tenants, result.rowCount ?? 0);
    }
    await client.query('COMMIT');
    return { tenants, checksum };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
