import 'dotenv/config';
import { database } from '../platform/database.js';
import { hashPassword } from '../modules/auth/password.js';

type UserSeed = { email: string; displayName: string; role: string; passwordEnv: string };

const users: UserSeed[] = [
  { email: 'infraestrutura@healthlink.local', displayName: 'Usuário Infraestrutura', role: 'tenant_administrator', passwordEnv: 'HEALTHLINK_INFRA_PASSWORD' },
  { email: 'tecnico.unidade@healthlink.local', displayName: 'Técnico de Unidade Móvel', role: 'supervisor', passwordEnv: 'HEALTHLINK_TECHNICIAN_PASSWORD' },
];

async function ensureRole(code: string, tenantId: string): Promise<string> {
  const result = await database.query('SELECT id FROM roles WHERE code = $1 AND (tenant_id = $2 OR tenant_id IS NULL) ORDER BY tenant_id NULLS LAST LIMIT 1', [code, tenantId]);
  if (result.rows[0]) return result.rows[0].id as string;
  const created = await database.query('INSERT INTO roles (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id', [tenantId, code, code.replaceAll('_', ' ')]);
  return created.rows[0].id as string;
}

async function main() {
  const tenant = await database.query("SELECT id FROM tenants WHERE slug = 'default' LIMIT 1");
  const tenantId = tenant.rows[0]?.id as string | undefined;
  if (!tenantId) throw new Error('Tenant "default" não encontrado.');

  for (const seed of users) {
    const password = process.env[seed.passwordEnv];
    if (!password || password.length < 8) throw new Error(`Defina ${seed.passwordEnv} com ao menos 8 caracteres.`);
    const passwordHash = await hashPassword(password);
    const existing = await database.query('SELECT id FROM users WHERE email = $1', [seed.email]);
    const user = existing.rows[0]
      ? existing
      : await database.query('INSERT INTO users (email, display_name, password_hash, active) VALUES ($1, $2, $3, true) RETURNING id', [seed.email, seed.displayName, passwordHash]);
    const userId = user.rows[0].id as string;
    if (existing.rows[0]) await database.query('UPDATE users SET display_name = $1, password_hash = $2, active = true, updated_at = now() WHERE id = $3', [seed.displayName, passwordHash, userId]);
    await database.query('INSERT INTO user_tenants (user_id, tenant_id, active) VALUES ($1, $2, true) ON CONFLICT (user_id, tenant_id) DO UPDATE SET active = true', [userId, tenantId]);
    const roleId = await ensureRole(seed.role, tenantId);
    await database.query('DELETE FROM user_role_assignments WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
    await database.query('INSERT INTO user_role_assignments (user_id, tenant_id, role_id) VALUES ($1, $2, $3)', [userId, tenantId, roleId]);
    console.log(`${seed.email} criado/atualizado com perfil ${seed.role}.`);
  }
}

try {
  await main();
} finally {
  await database.end();
}
