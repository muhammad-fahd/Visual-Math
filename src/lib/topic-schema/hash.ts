import { canonicalize } from './canonicalize';

/** `sha256:` plus 64 lowercase hex characters: the identity of one version of a topic (AD-19). */
export async function contentHash(doc: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(doc));
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto (crypto.subtle) is not available here; it needs Node 19 or later, or a secure browser context.');
  const digest = await subtle.digest('SHA-256', bytes);
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return `sha256:${hex}`;
}

export const CONTENT_HASH = /^sha256:[0-9a-f]{64}$/;
