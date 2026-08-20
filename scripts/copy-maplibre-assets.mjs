import { access, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const assetRoot = resolve(projectRoot, 'dist/web/assets');
const sourceRoot = resolve(projectRoot, 'node_modules/maplibre-gl/dist');

await mkdir(assetRoot, { recursive: true });
for (const fileName of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.js']) {
  const source = resolve(sourceRoot, fileName);
  try {
    await access(source);
    await copyFile(source, resolve(assetRoot, fileName));
  } catch {
    // The package can change its worker layout between versions; the app still
    // builds, while the asset test reports a missing runtime worker explicitly.
  }
}
