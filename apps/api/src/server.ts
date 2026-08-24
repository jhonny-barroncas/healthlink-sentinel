import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import authPlugin from './modules/auth/plugin.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { unitRoutes } from './modules/units/routes.js';
import { equipmentRoutes } from './modules/equipment/routes.js';
import { monitoringRoutes } from './modules/monitoring/routes.js';
import { zabbixRoutes } from './modules/integrations/zabbix/routes.js';
import { starlinkRoutes } from './modules/integrations/starlink/routes.js';
import { collectionAgentRoutes } from './modules/integrations/agent/routes.js';
import { synchronizeBuiltInAgentRelease } from './modules/integrations/agent/built-in-release.js';
import { userRoutes } from './modules/users/routes.js';
import { env } from './platform/env.js';
import { registerWebAssets } from './web-assets.js';

const app = Fastify({
  logger: true,
  ...(env.HTTPS ? { https: { key: readFileSync(resolve(process.cwd(), env.HTTPS_KEY_PATH)), cert: readFileSync(resolve(process.cwd(), env.HTTPS_CERT_PATH)) } } : {}),
});
await app.register(cors, {
  origin: [/^https?:\/\/(localhost|127\.0\.0\.1|aplicacao\.gbringel\.com|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):(3002|3003|517[3-9])$/],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
await app.register(authPlugin);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(unitRoutes);
await app.register(equipmentRoutes);
await app.register(monitoringRoutes);
await app.register(zabbixRoutes);
await app.register(starlinkRoutes);
await app.register(collectionAgentRoutes);
await app.register(userRoutes);

const webRoot = resolve(process.cwd(), 'dist/web');
if (existsSync(webRoot)) {
  await registerWebAssets(app, webRoot);
}

const builtInAgent = await synchronizeBuiltInAgentRelease();
app.log.info({ version: '1.0.0', tenants: builtInAgent.tenants, checksum: builtInAgent.checksum }, 'Built-in collection agent release synchronized');

await app.listen({ port: env.PORT, host: '0.0.0.0' });
