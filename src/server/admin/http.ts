import { z } from 'zod';

// Shared plumbing for the admin auth handlers: same-origin check, bounded JSON body validated by
// Zod, and the error envelope of AD-9. Database and Auth errors are never forwarded.

const MAX_BODY_BYTES = 4096;
const NO_STORE = { 'Cache-Control': 'no-store' };

export function errorResponse(status: number, code: string, message: string, details?: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers: { ...NO_STORE, ...headers } });
}

export const unauthorizedResponse = () => errorResponse(401, 'unauthorized', 'Sign-in required.');
export const invalidResponse = () => errorResponse(401, 'invalid_credentials', 'Those details did not work.');
export const lockedResponse = (retryAfterSeconds: number) =>
  errorResponse(429, 'locked', 'Too many attempts.', { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

/** Cookie-session routes accept a request only when its Origin is this site (AD-9). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/** Reads the body as text, stopping as soon as it passes `max` bytes (a chunked body has no Content-Length). */
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > max) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function readBody<S extends z.ZodType>(request: Request, schema: S, options: { maxBytes?: number } = {}): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  if (!sameOrigin(request)) return { ok: false, response: errorResponse(403, 'forbidden', 'Request not allowed.') };
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) return { ok: false, response: errorResponse(415, 'unsupported_media_type', 'Send JSON.') };
  const max = options.maxBytes ?? MAX_BODY_BYTES;
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > max) return { ok: false, response: errorResponse(413, 'too_large', 'Request too large.') };
  const text = await readCapped(request, max);
  if (text === null) return { ok: false, response: errorResponse(413, 'too_large', 'Request too large.') };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, response: errorResponse(400, 'invalid_body', 'Invalid request.') };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, response: errorResponse(400, 'invalid_body', 'Invalid request.', { paths: parsed.error.issues.map((i) => i.path.join('.')) }) };
  }
  return { ok: true, data: parsed.data };
}

/** Runs a handler body; any exception becomes `internal` with a request id and nothing else. */
export async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    // The id is printed with the error's class only, never its message (it may hold database text).
    const requestId = crypto.randomUUID();
    console.error(JSON.stringify({ level: 'error', requestId, kind: 'server', error: error instanceof Error ? error.name : 'unknown' }));
    return errorResponse(500, 'internal', 'Something went wrong.', { requestId });
  }
}
