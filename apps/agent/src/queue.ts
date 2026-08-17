import { readFile, rename, writeFile } from 'node:fs/promises';
import type { TelemetryBatch } from './collector.js';

export async function loadQueue(path: string): Promise<TelemetryBatch[]> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed as TelemetryBatch[] : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function saveQueue(path: string, batches: TelemetryBatch[]): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(batches.slice(-120)), { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, path);
}
