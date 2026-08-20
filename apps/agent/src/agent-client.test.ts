import { describe, expect, it } from 'vitest';
import { CollectionAgentClient } from './agent-client.js';

describe('collection agent client', () => {
  it('sends a heartbeat with only the installed version and platform', async () => {
    let request: { url: string; authorization: string | null; body: unknown } | null = null;
    const fetcher: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      request = { url: String(input), authorization: headers.get('authorization'), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const client = new CollectionAgentClient({
      apiUrl: 'https://healthlink.example',
      credential: 'hla_restrita',
      platform: 'windows',
      version: '1.0.0',
      timeoutMs: 3000,
    }, fetcher);

    await client.heartbeat();

    expect(request).toEqual({
      url: 'https://healthlink.example/v1/collection-agents/heartbeat',
      authorization: 'Bearer hla_restrita',
      body: { version: '1.0.0', platform: 'windows' },
    });
  });
});

