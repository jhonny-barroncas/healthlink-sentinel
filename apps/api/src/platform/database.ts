import { Pool, type PoolClient } from 'pg';
import { env } from './env.js';

export const database = new Pool({ connectionString: env.DATABASE_URL, max: 20 });

export async function withTenant<T>(tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
