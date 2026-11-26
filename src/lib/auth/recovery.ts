// Recovery codes: ten random codes shown once; only their hashes are stored (hashing is a server job).
// Alphabet without 0/O/1/I/L so a code can be read from paper.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 symbols
export const RECOVERY_CODE_COUNT = 10;
const GROUP = 5;

/** Build one code. `randomBytes` is injected (crypto on the server, a fake in tests). Bytes above
 *  the largest multiple of 31 are skipped so every symbol is equally likely. */
export function recoveryCode(randomBytes: (n: number) => Uint8Array): string {
  const limit = 256 - (256 % ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < GROUP * 2) {
    for (const b of randomBytes(GROUP * 4)) {
      if (b < limit && chars.length < GROUP * 2) chars.push(ALPHABET[b % ALPHABET.length]!);
    }
  }
  return `${chars.slice(0, GROUP).join('')}-${chars.slice(GROUP).join('')}`;
}

/** A full set of distinct codes. */
export function recoveryCodes(randomBytes: (n: number) => Uint8Array, count = RECOVERY_CODE_COUNT): string[] {
  const set = new Set<string>();
  for (let tries = 0; set.size < count; tries++) {
    if (tries > count * 50) throw new Error('random source is not random');
    set.add(recoveryCode(randomBytes));
  }
  return [...set];
}

/** Accept what a person types: any case, spaces, a missing dash. Returns null when it cannot be a code. */
export function normalizeRecoveryCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '');
  if (s.length !== GROUP * 2) return null;
  for (const c of s) if (!ALPHABET.includes(c)) return null;
  return `${s.slice(0, GROUP)}-${s.slice(GROUP)}`;
}
