export type AgentClientConfig = {
  apiUrl: string;
  credential: string;
  platform: 'windows' | 'linux';
  version: string;
  timeoutMs: number;
};

async function requestError(response: Response, operation: string): Promise<Error> {
  let detail = '';
  try {
    const body = await response.json() as { message?: unknown; error?: unknown };
    const value = body.message ?? body.error;
    if (typeof value === 'string') detail = value.trim().slice(0, 300);
  } catch {
    // Preserve status-only diagnostics for non-JSON responses.
  }
  return new Error(`${operation} falhou (HTTP ${response.status})${detail ? `: ${detail}` : ''}`);
}

export class CollectionAgentClient {
  constructor(private readonly config: AgentClientConfig, private readonly fetcher: typeof fetch = globalThis.fetch) {}

  async fetch(input: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${this.config.credential}`);
    return this.fetcher(input, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(this.config.timeoutMs) });
  }

  async heartbeat(): Promise<void> {
    const response = await this.fetch(`${this.config.apiUrl}/v1/collection-agents/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: this.config.version, platform: this.config.platform }),
    });
    if (!response.ok) throw await requestError(response, 'Heartbeat');
  }
}

