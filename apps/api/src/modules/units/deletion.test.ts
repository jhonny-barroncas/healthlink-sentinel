import { describe, expect, it } from 'vitest';
import { deleteHealthUnit } from './repository.js';

describe('deleteHealthUnit', () => {
  it('removes the unit and all tenant-scoped operational history before the cascade', async () => {
    const queries: string[] = [];
    const client = {
      query: async (text: string) => {
        queries.push(text);
        if (text.includes('RETURNING id')) return { rows: [{ id: 'unit-1' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
    } as never;

    await expect(deleteHealthUnit(client, 'tenant-1', 'unit-1')).resolves.toBe(true);

    expect(queries.some((query) => query.includes('DELETE FROM monitoring_events'))).toBe(true);
    expect(queries.some((query) => query.includes('DELETE FROM alerts'))).toBe(true);
    expect(queries.at(-1)).toContain('DELETE FROM health_units');
    expect(queries.at(-1)).toContain('tenant_id = $2');
  });
});
