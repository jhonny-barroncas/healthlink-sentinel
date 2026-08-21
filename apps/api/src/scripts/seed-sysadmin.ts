import 'dotenv/config';
import { database } from '../platform/database.js';
import { hashPassword } from '../modules/auth/password.js';
import { shouldResetPassword, validateBootstrapPassword } from './bootstrap-policy.js';

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

  const email = process.env.HEALTHLINK_SYSADMIN_EMAIL?.trim() || 'sysadmin@healthlink.local';
  const password = process.env.HEALTHLINK_SYSADMIN_PASSWORD;
  const validation = validateBootstrapPassword(password);
  if (!password) throw new Error('Defina HEALTHLINK_SYSADMIN_PASSWORD com ao menos 8 caracteres (ausente).');
  if (!validation.valid) throw new Error(`Defina HEALTHLINK_SYSADMIN_PASSWORD com ao menos 8 caracteres (${validation.reason}).`);

  const existing = await database.query('SELECT id FROM users WHERE email = $1', [email]);
  let userId: string;
  if (!existing.rows[0]) {
    const created = await database.query('INSERT INTO users (email, display_name, password_hash, active) VALUES ($1, $2, $3, true) RETURNING id', [email, 'Sysadmin HealthLink', await hashPassword(password)]);
    userId = created.rows[0].id as string;
  } else {
    userId = existing.rows[0].id as string;
    if (shouldResetPassword(process.env.HEALTHLINK_SYSADMIN_RESET_PASSWORD)) {
      await database.query('UPDATE users SET display_name = $1, password_hash = $2, active = true, updated_at = now() WHERE id = $3', ['Sysadmin HealthLink', await hashPassword(password), userId]);
    } else {
      await database.query('UPDATE users SET display_name = $1, active = true, updated_at = now() WHERE id = $2', ['Sysadmin HealthLink', userId]);
    }
  }

  await database.query('INSERT INTO user_tenants (user_id, tenant_id, active) VALUES ($1, $2, true) ON CONFLICT (user_id, tenant_id) DO UPDATE SET active = true', [userId, tenantId]);
  const roleId = await ensureRole('tenant_administrator', tenantId);
  await database.query('DELETE FROM user_role_assignments WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
  await database.query('INSERT INTO user_role_assignments (user_id, tenant_id, role_id) VALUES ($1, $2, $3)', [userId, tenantId, roleId]);
  console.log(`${email} garantido com perfil tenant_administrator.`);
}

try {
  await main();
} finally {
  await database.end();
}
