// Client calls to the admin auth handlers. Returns a small result and never throws.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; retryAfterSeconds?: number };

export async function post<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
    const json = (await res.json().catch(() => null)) as { error?: { code?: string; details?: { retryAfterSeconds?: number } } } | null;
    if (res.ok) return { ok: true, data: json as T };
    return { ok: false, status: res.status, code: json?.error?.code ?? 'error', retryAfterSeconds: json?.error?.details?.retryAfterSeconds };
  } catch {
    return { ok: false, status: 0, code: 'network' };
  }
}
