import 'server-only';
import { adminClient } from '../db/admin';

export type Health = { status: number; body: { status: 'ok' | 'down'; db: 'ok' | 'down' | 'unconfigured' } };

const TIMEOUT_MS = 3000;
const DOWN: Health = { status: 503, body: { status: 'down', db: 'down' } };

/**
 * One cheap read of the seeded tree. Any failure, or no answer within three seconds, is "down": the
 * monitor alerts and the message stays private. Locally, with no database configured, the site is
 * fine ("unconfigured"); on a deployment (VERCEL_ENV is set) that is a misconfiguration, so it is down.
 */
export async function checkHealth(): Promise<Health> {
  const client = adminClient();
  if (!client) {
    return process.env.VERCEL_ENV ? { status: 503, body: { status: 'down', db: 'unconfigured' } } : { status: 200, body: { status: 'ok', db: 'unconfigured' } };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = Promise.resolve(client.from('category').select('id').limit(1)).then(({ error }) => (error ? DOWN : ({ status: 200, body: { status: 'ok', db: 'ok' } } as Health)));
    const timeout = new Promise<Health>((resolve) => {
      timer = setTimeout(() => resolve(DOWN), TIMEOUT_MS);
    });
    return await Promise.race([query, timeout]);
  } catch {
    return DOWN;
  } finally {
    clearTimeout(timer);
  }
}
