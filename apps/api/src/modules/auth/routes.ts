import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, database } from '../../platform/database.js';
import { hashPassword, verifyPassword } from './password.js';
import { consumeSession, createSession, findUserByEmail, hashRefreshToken, listMemberships, newRefreshToken, revokeSession } from './repository.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8), tenantId: z.string().uuid().optional() });
const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const accessTtlSeconds = 15 * 60;
const refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

function unauthorized(message = 'Credenciais inválidas.') { const error = new Error(message) as Error & { statusCode: number }; error.statusCode = 401; return error; }

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await findUserByEmail(database, input.email);
    if (!user || !user.active || !(await verifyPassword(input.password, user.password_hash))) throw unauthorized();
    const memberships = await listMemberships(database, user.id);
    if (memberships.length === 0) throw unauthorized('Usuário sem acesso a um cliente.');
    const membership = memberships.find((item) => item.tenant_id === input.tenantId) ?? memberships[0];
    const refreshToken = newRefreshToken();
    await withTenant(membership.tenant_id, async (client) => createSession(client, user.id, membership.tenant_id, hashRefreshToken(refreshToken), new Date(Date.now() + refreshTtlMs)));
    const accessToken = await app.jwt.sign({ sub: user.id, tenantId: membership.tenant_id, roles: membership.roles }, { expiresIn: accessTtlSeconds });
    return reply.send({ accessToken, refreshToken, expiresIn: accessTtlSeconds, user: { id: user.id, email: user.email, displayName: user.display_name }, tenant: { id: membership.tenant_id, name: membership.tenant_name, roles: membership.roles }, availableTenants: memberships.map(({ tenant_id, tenant_name }) => ({ id: tenant_id, name: tenant_name })) });
  });

  app.post('/v1/auth/refresh', async (request) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const session = await consumeSession(database, hashRefreshToken(refreshToken));
    if (!session) throw unauthorized('Sessão expirada ou revogada.');
    const memberships = await withTenant(session.tenant_id, (client) => listMemberships(client, session.user_id));
    const roles = memberships.find((item) => item.tenant_id === session.tenant_id)?.roles ?? [];
    const accessToken = await app.jwt.sign({ sub: session.user_id, tenantId: session.tenant_id, roles }, { expiresIn: accessTtlSeconds });
    return { accessToken, expiresIn: accessTtlSeconds };
  });

  app.post('/v1/auth/logout', async (request) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    await revokeSession(database, hashRefreshToken(refreshToken));
    return { success: true };
  });

  app.get('/v1/auth/me', { preHandler: [app.authenticate] }, async (request) => ({ userId: request.auth.userId, tenantId: request.auth.tenantId, roles: request.auth.roles }));

  app.post('/v1/auth/hash-password', async (request) => {
    if (process.env.NODE_ENV === 'production') throw unauthorized('Endpoint indisponível.');
    const body = z.object({ password: z.string().min(8) }).parse(request.body);
    return { hash: await hashPassword(body.password) };
  });
};
