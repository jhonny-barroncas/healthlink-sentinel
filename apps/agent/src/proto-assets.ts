import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize, sep } from 'node:path';

declare const __HEALTHLINK_STARLINK_PROTOS__: Record<string, string>;

export function bundledProtoAssets(): Record<string, string> | null {
  return typeof __HEALTHLINK_STARLINK_PROTOS__ === 'object' ? __HEALTHLINK_STARLINK_PROTOS__ : null;
}

export async function materializeEmbeddedProtos(dataDir: string, assets: Record<string, string>): Promise<string> {
  const root = join(dataDir, 'proto');
  for (const [relativePath, content] of Object.entries(assets)) {
    const normalized = normalize(relativePath.replaceAll('/', sep));
    if (isAbsolute(normalized) || normalized === '..' || normalized.startsWith(`..${sep}`)) continue;
    const destination = join(root, normalized);
    await mkdir(join(destination, '..'), { recursive: true });
    await writeFile(destination, content, { encoding: 'utf8', mode: 0o600 });
  }
  return root;
}
