type InternalApp = {
  inject: (request: {
    method: 'POST';
    url: string;
    headers: Record<string, string>;
    payload: Record<string, never>;
  }) => Promise<{ statusCode: number }>;
};

export async function invokeInternalPost(app: InternalApp, url: string, token: string): Promise<{ ok: boolean; status: number }> {
  const response = await app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload: {},
  });
  return { ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode };
}
