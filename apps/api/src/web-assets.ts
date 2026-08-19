import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

export async function registerWebAssets(app: FastifyInstance, webRoot: string): Promise<void> {
  await app.register(fastifyStatic, { root: webRoot, prefix: '/', wildcard: false });
  app.get('/*', async (_request, reply) => reply.sendFile('index.html'));
}
