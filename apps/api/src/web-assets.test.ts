import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { registerWebAssets } from './web-assets.js';
import { resolve } from 'node:path';

describe('web asset routes', () => {
  it('keeps the SPA fallback unique when static assets are registered', async () => {
    const app = Fastify();
    await registerWebAssets(app, resolve(process.cwd(), 'dist/web'));
    const routes = app.printRoutes();
    expect(routes).toContain('└── * (GET, HEAD)');
    await app.close();
  });
});
