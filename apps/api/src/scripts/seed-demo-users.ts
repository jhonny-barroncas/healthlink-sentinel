import 'dotenv/config';
import { database } from '../platform/database.js';
import { hashPassword } from '../modules/auth/password.js';

const firstNames = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Leonardo', 'Mariana', 'Nathan', 'Olívia', 'Paulo', 'Queila', 'Rafael', 'Sabrina', 'Thiago', 'Ursula', 'Vinícius', 'Wesley', 'Ximena', 'Yasmin', 'Zeca', 'Camila', 'Douglas', 'Eduarda', 'Felipe'];
const lastNames = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Nunes', 'Teixeira'];
const roles = ['tenant_administrator', 'supervisor', 'noc_operator', 'service_agent', 'viewer'];

async function ensureRole(code: string, tenantId: string): Promise<string> {
  const existing = await database.query('SELECT id FROM roles WHERE code = $1 AND (tenant_id = $2 OR tenant_id IS NULL) ORDER BY tenant_id NULLS LAST LIMIT 1', [code, tenantId]);
  if (existing.rows[0]) return existing.rows[0].id as string;
  const created = await database.query('INSERT INTO roles (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id', [tenantId, code, code.replaceAll('_', ' ')]);
  return created.rows[0].id as string;
}

async function main() {
  const tenant = await database.query("SELECT id FROM tenants WHERE slug = 'default' LIMIT 1");
  const tenantId = tenant.rows[0]?.id as string | undefined;
  if (!tenantId) throw new Error('Tenant "default" não encontrado.');

  const passwordHash = await hashPassword('Demo@12345');
  let created = 0;
  for (let i = 0; i < firstNames.length; i++) {
    const first = firstNames[i];
    const last = lastNames[i % lastNames.length];
    const displayName = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}.seed${i}@healthlink.demo`;
    const role = roles[i % roles.length];
    const active = i % 6 !== 0;

    const existing = await database.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId: string;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await database.query('UPDATE users SET display_name = $1, active = $2, updated_at = now() WHERE id = $3', [displayName, active, userId]);
    } else {
      const inserted = await database.query(
        'INSERT INTO users (email, display_name, password_hash, active) VALUES ($1, $2, $3, $4) RETURNING id',
        [email, displayName, passwordHash, active],
      );
      userId = inserted.rows[0].id;
      created++;
    }
    await database.query(
      'INSERT INTO user_tenants (user_id, tenant_id, active) VALUES ($1, $2, $3) ON CONFLICT (user_id, tenant_id) DO UPDATE SET active = $3',
      [userId, tenantId, active],
    );
    const roleId = await ensureRole(role, tenantId);
    await database.query('DELETE FROM user_role_assignments WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
    await database.query('INSERT INTO user_role_assignments (user_id, tenant_id, role_id) VALUES ($1, $2, $3)', [userId, tenantId, roleId]);
  }

  process.stdout.write(`Seed de usuários concluído. ${created} usuário(s) novo(s), ${firstNames.length - created} atualizado(s). Senha padrão: Demo@12345\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Falha ao gerar usuários de demonstração.'}\n`);
  process.exitCode = 1;
} finally {
  await database.end();
}
