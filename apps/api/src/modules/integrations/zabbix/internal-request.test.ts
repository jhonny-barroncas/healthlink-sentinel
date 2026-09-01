import { describe, expect, it } from 'vitest';
import { invokeInternalPost } from './internal-request.js';

describe('invokeInternalPost', () => {
  it('invoca a rota internamente sem depender do protocolo HTTP do servidor', async () => {
    const calls: unknown[] = [];
    const app = {
      inject: async (request: unknown) => {
        calls.push(request);
        return { statusCode: 200 };
      },
    };

    const response = await invokeInternalPost(app, '/v1/integrations/zabbix/sync', 'token');

    expect(response.ok).toBe(true);
    expect(calls).toEqual([{
      method: 'POST',
      url: '/v1/integrations/zabbix/sync',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      payload: {},
    }]);
  });
});
