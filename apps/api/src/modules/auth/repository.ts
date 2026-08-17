import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient, Pool } from 'pg';

type Queryable = Pick<PoolClient | Pool, 'query'>;

export interface AuthUser { id: string; email: string; display_name: string; password_hash: string; active: boolean; }
export interface TenantMembership { tenant_id: string; tenant_name: string; roles: string[]; }

export async function findUserByEmail(client: Queryable, email: string): Promise<AuthUser | null> {
  const result = await client.query<AuthUser>('SELECT id, email, display_name, password_hash, active FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
  return result.rows[0] ?? null;
}

export async function listMemberships(client: Queryable, userId: string): Promise<TenantMembership[]> {
  const result = await client.query<TenantMembership>(`
    SELECT t.id AS tenant_id, t.name AS tenant_name,
           COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
    FROM user_tenants ut
    JOIN tenants t ON t.id = ut.tenant_id AND t.active
    LEFT JOIN user_role_assignments ura ON ura.user_id = ut.user_id AND ura.tenant_id = ut.tenant_id
    LEFT JOIN roles r ON r.id = ura.role_id
    WHERE ut.user_id = $1 AND ut.active
    GROUP BY t.id, t.name
    ORDER BY t.name
  `, [userId]);
  return result.rows;
}

export function hashRefreshToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function newRefreshToken(): string { return randomBytes(48).toString('base64url'); }

export async function createSession(client: Queryable, userId: string, tenantId: string, refreshTokenHash: string, expiresAt: Date): Promise<void> {
  await client.query('INSERT INTO user_sessions (user_id, tenant_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, $4)', [userId, tenantId, refreshTokenHash, expiresAt]);
}

export async function consumeSession(client: Queryable, refreshTokenHash: string): Promise<{ user_id: string; tenant_id: string } | null> {
  const result = await client.query<{ user_id: string; tenant_id: string }>(`
    UPDATE user_sessions SET last_used_at = now()
    WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
    RETURNING user_id, tenant_id
  `, [refreshTokenHash]);
  return result.rows[0] ?? null;
}

export async function revokeSession(client: Queryable, refreshTokenHash: string): Promise<void> {
  await client.query('UPDATE user_sessions SET revoked_at = now() WHERE refresh_token_hash = $1', [refreshTokenHash]);
}
