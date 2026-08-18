import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { database, withTenant } from '../../platform/database.js';
import { hasPermission, permission } from '../../platform/authorization.js';
import { hashPassword } from '../auth/password.js';

const userSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(200),
  role: z.enum(['tenant_administrator', 'supervisor', 'noc_operator', 'viewer', 'service_agent']).default('viewer'),
});
const updateSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(['tenant_administrator', 'supervisor', 'noc_operator', 'viewer', 'service_agent']).optional(),
  active: z.boolean().optional(),
});

function requireManage(request: { auth: { roles: string[] } }) {
  if (!hasPermission(request.auth.roles, permission.usersManage)) throw Object.assign(new Error('Permissão insuficiente.'), { statusCode: 403 });
}

async function ensureRole(client: { query: (sql: string, params?: unknown[]) => Promise<any> }, code: string, tenantId: string): Promise<string> {
  const existing = await client.query('SELECT id FROM roles WHERE code = $1 AND (tenant_id = $2 OR tenant_id IS NULL) ORDER BY tenant_id NULLS LAST LIMIT 1', [code, tenantId]);
  if (existing.rows[0]) return existing.rows[0].id as string;
  const created = await client.query('INSERT INTO roles (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id', [tenantId, code, code.replaceAll('_', ' ')]);
  return created.rows[0].id as string;
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  await database.query(`CREATE TABLE IF NOT EXISTS access_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email citext NOT NULL, display_name text NOT NULL, password_hash text NOT NULL, requested_role text NOT NULL DEFAULT 'viewer', status text NOT NULL DEFAULT 'pending', reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`);
  app.post('/v1/access-requests', async (request, reply) => {
    const input = userSchema.parse(request.body);
    const existingUser = await database.query('SELECT 1 FROM users WHERE email = $1', [input.email]);
    if (existingUser.rowCount) throw Object.assign(new Error('Já existe uma conta cadastrada com este e-mail.'), { statusCode: 409 });
    const existingRequest = await database.query('SELECT 1 FROM access_requests WHERE email = $1 AND status = $2', [input.email, 'pending']);
    if (existingRequest.rowCount) throw Object.assign(new Error('Já existe uma solicitação pendente para este e-mail. Aguarde a análise do administrador.'), { statusCode: 409 });
    await database.query('INSERT INTO access_requests (email, display_name, password_hash, requested_role) VALUES ($1, $2, $3, $4)', [input.email, input.displayName, await hashPassword(input.password), input.role]);
    return reply.code(201).send({ success: true });
  });
  app.get('/v1/users/access-requests', { preHandler: [app.authenticate] }, async (request) => {
    requireManage(request);
    const result = await database.query('SELECT id, email, display_name, requested_role, status, created_at FROM access_requests WHERE status = $1 ORDER BY created_at DESC', ['pending']);
    return result.rows;
  });
  app.post('/v1/users/access-requests/:id/approve', { preHandler: [app.authenticate] }, async (request) => {
    requireManage(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return withTenant(request.auth.tenantId, async (client) => {
      const requestRow = await client.query('SELECT * FROM access_requests WHERE id = $1 AND status = $2 FOR UPDATE', [id, 'pending']);
      if (!requestRow.rows[0]) throw Object.assign(new Error('Solicitação não encontrada ou já analisada.'), { statusCode: 404 });
      const item = requestRow.rows[0];
      // A request may have been submitted more than once for an existing identity.
      // Approval must be idempotent instead of failing on users.email UNIQUE.
      const existing = await client.query('SELECT id, email, display_name FROM users WHERE email = $1', [item.email]);
      const user = existing.rows[0]
        ? existing
        : await client.query('INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name', [item.email, item.display_name, item.password_hash]);
      await client.query('INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2) ON CONFLICT (user_id, tenant_id) DO UPDATE SET active = true', [user.rows[0].id, request.auth.tenantId]);
      const roleId = await ensureRole(client, item.requested_role, request.auth.tenantId);
      await client.query('INSERT INTO user_role_assignments (user_id, tenant_id, role_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, tenant_id, role_id) DO NOTHING', [user.rows[0].id, request.auth.tenantId, roleId]);
      await client.query('UPDATE access_requests SET status = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3', ['approved', request.auth.userId, id]);
      return user.rows[0];
    });
  });
  app.delete('/v1/users/access-requests/:id', { preHandler: [app.authenticate] }, async (request) => {
    requireManage(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await database.query('UPDATE access_requests SET status = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3 AND status = $4', ['rejected', request.auth.userId, id, 'pending']);
    return { success: true };
  });

  app.get('/v1/users', { preHandler: [app.authenticate] }, async (request) => {
    requireManage(request);
    return withTenant(request.auth.tenantId, async (client) => {
      const result = await client.query(`
        SELECT u.id, u.email, u.display_name, ut.active AS active, u.last_access_at, u.created_at,
               COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
        FROM users u
        JOIN user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = $1
        LEFT JOIN user_role_assignments ura ON ura.user_id = u.id AND ura.tenant_id = $1
        LEFT JOIN roles r ON r.id = ura.role_id
        GROUP BY u.id, ut.active ORDER BY u.display_name`, [request.auth.tenantId]);
      return result.rows;
    });
  });

  app.post('/v1/users', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireManage(request);
    const input = userSchema.parse(request.body);
    const existingUser = await database.query('SELECT 1 FROM users WHERE email = $1', [input.email]);
    if (existingUser.rowCount) throw Object.assign(new Error('Já existe um usuário cadastrado com este e-mail.'), { statusCode: 409 });
    const passwordHash = await hashPassword(input.password);
    const created = await withTenant(request.auth.tenantId, async (client) => {
      const user = await client.query<{ id: string; email: string; display_name: string }>(
        `INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name`,
        [input.email, input.displayName, passwordHash]);
      await client.query('INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2)', [user.rows[0].id, request.auth.tenantId]);
      const roleId = await ensureRole(client, input.role, request.auth.tenantId);
      await client.query('INSERT INTO user_role_assignments (user_id, tenant_id, role_id) VALUES ($1, $2, $3)', [user.rows[0].id, request.auth.tenantId, roleId]);
      return user.rows[0];
    }).catch((reason) => {
      if (reason?.code === '23505') throw Object.assign(new Error('Já existe um usuário cadastrado com este e-mail.'), { statusCode: 409 });
      throw reason;
    });
    return reply.code(201).send(created);
  });

  app.patch('/v1/users/:id', { preHandler: [app.authenticate] }, async (request) => {
    requireManage(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = updateSchema.parse(request.body);
    return withTenant(request.auth.tenantId, async (client) => {
      const membership = await client.query('SELECT 1 FROM user_tenants WHERE user_id = $1 AND tenant_id = $2', [id, request.auth.tenantId]);
      if (!membership.rowCount) throw Object.assign(new Error('Usuário não encontrado neste cliente.'), { statusCode: 404 });
      const fields: string[] = []; const values: unknown[] = [];
      if (input.displayName !== undefined) { fields.push(`display_name = $${values.length + 1}`); values.push(input.displayName); }
      if (input.password !== undefined) { fields.push(`password_hash = $${values.length + 1}`); values.push(await hashPassword(input.password)); }
      if (input.active !== undefined) { fields.push(`active = $${values.length + 1}`); values.push(input.active); await client.query('UPDATE user_tenants SET active = $1 WHERE user_id = $2 AND tenant_id = $3', [input.active, id, request.auth.tenantId]); }
      if (fields.length) { values.push(id); await client.query(`UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values); }
      if (input.role) {
        const roleId = await ensureRole(client, input.role, request.auth.tenantId);
        await client.query('DELETE FROM user_role_assignments WHERE user_id = $1 AND tenant_id = $2', [id, request.auth.tenantId]);
        await client.query('INSERT INTO user_role_assignments (user_id, tenant_id, role_id) VALUES ($1, $2, $3)', [id, request.auth.tenantId, roleId]);
      }
      const result = await client.query('SELECT id, email, display_name, active FROM users WHERE id = $1', [id]);
      return result.rows[0];
    });
  });

  app.delete('/v1/users/:id', { preHandler: [app.authenticate] }, async (request) => {
    requireManage(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (id === request.auth.userId) throw Object.assign(new Error('Não é possível excluir o próprio usuário.'), { statusCode: 400 });
    await withTenant(request.auth.tenantId, async (client) => {
      await client.query('DELETE FROM user_tenants WHERE user_id = $1 AND tenant_id = $2', [id, request.auth.tenantId]);
      await client.query('UPDATE users SET active = false, updated_at = now() WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM user_tenants WHERE user_id = $1 AND active)', [id]);
    });
    return { success: true };
  });
};
