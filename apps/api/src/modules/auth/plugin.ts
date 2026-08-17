import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyRequest } from 'fastify';
import { env } from '../../platform/env.js';

declare module 'fastify' {
  interface FastifyInstance { authenticate(request: FastifyRequest): Promise<void>; }
  interface FastifyRequest { auth: { userId: string; tenantId: string; roles: string[] }; }
}

export default fp(async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET });
  app.decorate('authenticate', async (request) => {
    await request.jwtVerify();
    const claims = request.user as { sub: string; tenantId: string; roles?: string[] };
    if (!claims.sub || !claims.tenantId) {
      const error = new Error('Tenant context is required.') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }
    request.auth = { userId: claims.sub, tenantId: claims.tenantId, roles: claims.roles ?? [] };
  });
});
