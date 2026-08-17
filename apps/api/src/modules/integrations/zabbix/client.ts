export interface ZabbixTransport {
  request<T>(method: string, params: Record<string, unknown>): Promise<T>;
}

export class ZabbixHttpTransport implements ZabbixTransport {
  public constructor(private readonly apiUrl: string, private readonly apiToken: string) {}

  async request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiToken}` },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() }),
    });
    if (!response.ok) throw Object.assign(new Error(`Zabbix HTTP error: ${response.status}`), { statusCode: 502 });
    const payload = await response.json() as { result?: T; error?: { message?: string; data?: string } };
    if (payload.error) throw Object.assign(new Error(`Zabbix API error: ${payload.error.message ?? 'unknown'} ${payload.error.data ?? ''}`), { statusCode: 502 });
    return payload.result as T;
  }
}

/** Adapter boundary: domain modules must never call Zabbix HTTP directly. */
export class ZabbixClient {
  public constructor(private readonly transport: ZabbixTransport) {}

  getHosts(params: Record<string, unknown> = {}) { return this.transport.request('host.get', params); }
  createHost(params: Record<string, unknown>) { return this.transport.request('host.create', params); }
  getProblems(params: Record<string, unknown>) { return this.transport.request('problem.get', params); }
  getItems(params: Record<string, unknown>) { return this.transport.request('item.get', params); }
  getHistory(params: Record<string, unknown>) { return this.transport.request('history.get', params); }
  getEvents(params: Record<string, unknown>) { return this.transport.request('event.get', params); }
}
