// Accept-Language negotiation (FR-6.3). Pure: the supported locales are a parameter.

export type LanguageRange = { tag: string; q: number };

/** Parses an Accept-Language header into ranges ordered by quality. Malformed pieces are skipped, never thrown. */
export function parseAcceptLanguage(header: string | null | undefined): LanguageRange[] {
  if (!header) return [];
  const ranges: LanguageRange[] = [];
  header.slice(0, 1000).split(',').forEach((part, index) => {
    const [rawTag, ...params] = part.trim().split(';');
    const tag = (rawTag ?? '').trim().toLowerCase();
    if (!/^([a-z]{1,8}(-[a-z0-9]{1,8})*|\*)$/.test(tag)) return;
    let q = 1;
    for (const p of params) {
      const m = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(p);
      if (m) q = Number(m[1]);
    }
    if (!Number.isFinite(q) || q <= 0 || q > 1) return; // q=0 means "not acceptable"; out of range is malformed
    ranges.push({ tag, q: q - index * 1e-9 }); // earlier entries win ties, stable
  });
  return ranges.sort((a, b) => b.q - a.q);
}

/** First supported locale the visitor prefers, matching `ur-PK` to `ur`; `fallback` if none match. */
export function negotiateLocale<L extends string>(header: string | null | undefined, locales: readonly L[], fallback: L): L {
  for (const { tag } of parseAcceptLanguage(header)) {
    if (tag === '*') continue;
    const exact = locales.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
    const primary = tag.split('-')[0];
    const byPrimary = locales.find((l) => l.toLowerCase() === primary);
    if (byPrimary) return byPrimary;
  }
  return fallback;
}
