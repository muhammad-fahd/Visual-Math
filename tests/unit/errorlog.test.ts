import { describe, expect, it, vi } from 'vitest';
import { scrubLog } from '../../src/server/errorlog';

describe('scrubLog: the only thing that reaches the database and the logs', () => {
  it('scrubs the message, path and detail', () => {
    const out = scrubLog({
      requestId: 'r-1',
      kind: 'client',
      path: '/en/search?q=ana@example.com',
      message: 'failed for ana@example.com',
      detail: 'at f (https://site.test/a.js?token=abc:1:1) from 203.0.113.9',
    });
    expect(out).toEqual({
      requestId: 'r-1',
      kind: 'client',
      path: '/en/search',
      message: 'failed for [email]',
      // Over-scrubbing is the safe side: a query runs to the next space, so the line:column after it goes too.
      detail: 'at f (https://site.test/a.js from [ip]',
    });
  });
  it('an empty message is replaced by a marker; no detail is null', () => {
    expect(scrubLog({ requestId: 'r', kind: 'server', path: undefined, message: '   ' })).toMatchObject({ message: '(no message)', path: '/', detail: null });
  });
});

describe('guarded() prints the request id and the error class, never the message', () => {
  it('logs structured JSON without the error text', async () => {
    const { guarded } = await import('../../src/server/admin/http');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await guarded(async () => {
      throw new TypeError('relation "admin_user" does not exist for ana@example.com');
    });
    expect(res.status).toBe(500);
    const line = String(spy.mock.calls[0]?.[0]);
    const entry = JSON.parse(line) as { requestId: string; error: string };
    expect(entry.error).toBe('TypeError');
    expect(line).not.toMatch(/admin_user|ana@/);
    expect((await res.json()).error.details.requestId).toBe(entry.requestId);
    spy.mockRestore();
  });
});
