import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { registerWebAssets } from './web-assets.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('web asset routes', () => {
  it('keeps the SPA fallback unique when static assets are registered', async () => {
    const app = Fastify();
    await registerWebAssets(app, resolve(process.cwd(), 'dist/web'));
    const routes = app.printRoutes();
    expect(routes).toContain('└── * (GET, HEAD)');
    const missingAsset = await app.inject({ method: 'GET', url: '/assets/missing-worker.js' });
    expect(missingAsset.statusCode).toBe(404);
    expect(missingAsset.headers['content-type']).not.toContain('text/html');
    await app.close();
  });

  it('packages the MapLibre module worker and its shared module in the runtime image', () => {
    const assetRoot = resolve(process.cwd(), 'dist/web/assets');
    expect(existsSync(resolve(assetRoot, 'maplibre-gl-worker.mjs'))).toBe(true);
    expect(existsSync(resolve(assetRoot, 'maplibre-gl-shared.mjs'))).toBe(true);
  });
});
