import type { AgentConfig } from './config.js';

type LoginResponse = { accessToken: string; refreshToken: string };

async function apiError(response: Response, operation: string): Promise<Error> {
  let detail = '';
  try {
    const body = await response.text();
    if (body) {
      try {
        const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
        const value = parsed.message ?? parsed.error;
        if (typeof value === 'string') detail = value;
      } catch {
        detail = body.replace(/\s+/g, ' ').trim();
      }
    }
  } catch {
    // Preserve the HTTP status when the response body cannot be read.
  }
  const suffix = detail ? `: ${detail.slice(0, 300)}` : '';
  return new Error(`${operation} (HTTP ${response.status})${suffix}`);
}

export class HealthLinkAuth {
  private accessToken?: string;
  private refreshToken?: string;

  constructor(private readonly config: AgentConfig) {
    this.accessToken = config.apiToken;
  }

  private async login(): Promise<string> {
    if (!this.config.apiEmail || !this.config.apiPassword) throw new Error('Credenciais do usuário de serviço não configuradas.');
    const response = await fetch(`${this.config.apiUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: this.config.apiEmail, password: this.config.apiPassword, tenantId: this.config.tenantId }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!response.ok) throw await apiError(response, 'Login do agente rejeitado pela API');
    const result = await response.json() as LoginResponse;
    this.accessToken = result.accessToken;
    this.refreshToken = result.refreshToken;
    return result.accessToken;
  }

  private async refresh(): Promise<string> {
    if (!this.refreshToken) return this.login();
    const response = await fetch(`${this.config.apiUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!response.ok) return this.login();
    const result = await response.json() as { accessToken: string };
    this.accessToken = result.accessToken;
    return result.accessToken;
  }

  async fetch(input: string, init: RequestInit = {}): Promise<Response> {
    const token = this.accessToken ?? await this.login();
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    const response = await globalThis.fetch(input, { ...init, headers });
    if (response.status !== 401 || this.config.apiToken) return response;
    const renewed = await this.refresh();
    headers.set('authorization', `Bearer ${renewed}`);
    return globalThis.fetch(input, { ...init, headers });
  }
}
