import { describe, expect, it } from 'vitest';
import { buildCsp, safeOrigin, securityHeaders } from '../../src/lib/security/csp';
import { scrubDetail, scrubMessage, scrubPath } from '../../src/lib/security/scrub';

describe('CSP (AD-17, owner decision 2026-11-26)', () => {
  const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `) || d === name);

  it('is closed except for the inline scripts and styles Next needs', () => {
    const csp = buildCsp();
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'script-src')).toBe("script-src 'self' 'unsafe-inline'");
    expect(directive(csp, 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self'");
    expect(directive(csp, 'font-src')).toBe("font-src 'self'");
    expect(directive(csp, 'img-src')).toBe("img-src 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });
  it('never carries a hash or a nonce in script-src (that would make browsers ignore unsafe-inline)', () => {
    for (const admin of [false, true]) expect(buildCsp({ admin, storageOrigin: 'https://x.supabase.co' })).not.toMatch(/'(sha\d+-|nonce-)/);
  });
  it('no wildcard, no http, no eval', () => {
    const csp = buildCsp({ storageOrigin: 'https://x.supabase.co', admin: true });
    expect(csp).not.toMatch(/\*|http:|unsafe-eval|data:.*script/);
    expect(directive(csp, 'script-src')).not.toContain('https://');
  });
  it('the admin area alone may show data: images', () => {
    expect(directive(buildCsp({ admin: true }), 'img-src')).toBe("img-src 'self' data:");
    expect(buildCsp()).not.toContain('data:');
  });
  it('the storage origin is added to img-src and connect-src only', () => {
    const csp = buildCsp({ storageOrigin: 'https://abc.supabase.co/storage/v1' });
    expect(directive(csp, 'img-src')).toBe("img-src 'self' https://abc.supabase.co");
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https://abc.supabase.co");
    expect(directive(csp, 'script-src')).not.toContain('supabase');
  });
  it('a storage origin that is not a plain https origin is ignored, not trusted', () => {
    for (const bad of ['http://x.test', 'javascript:alert(1)', 'not a url', 'https://user:pw@x.test', '*', "https://x.test; script-src *", '']) {
      expect(safeOrigin(bad), bad).toBeNull();
      expect(buildCsp({ storageOrigin: bad })).toBe(buildCsp());
    }
    expect(safeOrigin(undefined)).toBeNull();
  });
  it('the other headers are present', () => {
    const h = Object.fromEntries(securityHeaders().map((x) => [x.key, x.value]));
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000'); // no includeSubDomains until the domain is final
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(h['Permissions-Policy']).toMatch(/camera=\(\)/);
    expect(h['Content-Security-Policy']).toBe(buildCsp());
  });
});

describe('scrubbing for the error log (AD-26, NFR-2.2)', () => {
  it('removes emails, addresses, tokens and long numbers', () => {
    const out = scrubMessage('failed for ana@example.com from 203.0.113.9 and 2001:db8::1 token eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY3.abcDEFghi call 03001234567');
    expect(out).not.toMatch(/ana@|203\.0|2001:db8|eyJ|03001234567/);
    expect(out).toContain('[email]');
    expect(out).toContain('[ip]');
    expect(out).toContain('[token]');
    expect(out).toContain('[number]');
  });
  it('removes long opaque strings (keys, session ids) but keeps ordinary words', () => {
    expect(scrubMessage('Cannot read properties of undefined (reading "x") key=' + 'a1B2c3D4'.repeat(5))).toBe('Cannot read properties of undefined (reading "x") [token]');
  });
  it('a URL loses its query and fragment', () => {
    expect(scrubMessage('GET https://site.test/en/topic/a?email=x&session=1#frag failed')).toBe('GET https://site.test/en/topic/a failed');
  });
  it('cuts to length, strips control characters, and handles non-strings', () => {
    expect(scrubMessage('word '.repeat(200))).toHaveLength(500);
    expect(scrubMessage('x'.repeat(900))).toBe('[token]');
    expect(scrubMessage('at 12:30:45 ok ::1 and fe80::1ff:fe23:4567:890a end')).toBe('at 12:30:45 ok [ip] and [ip] end');
    expect(scrubMessage('line1\nFAKE\u0007\u0000 entry')).not.toMatch(/[\u0000-\u0008]/);
    expect(scrubMessage(undefined)).toBe('');
    expect(scrubMessage({ a: 1 })).toBe('');
    expect(scrubDetail('')).toBeNull();
    expect(scrubDetail('at fn (file.js) '.repeat(500))).toHaveLength(2000);
  });
  it('Eastern Arabic-Indic digits and Unicode email addresses are scrubbed too', () => {
    expect(scrubMessage('call \u0660\u0663\u0660\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667')).toBe('call [number]');
    expect(scrubMessage('call \u06F0\u06F3\u06F0\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7')).toBe('call [number]');
    expect(scrubMessage('mail \u0627\u062D\u0645\u062F@\u0645\u062B\u0627\u0644.com sent')).toBe('mail [email] sent');
    expect(scrubMessage('order 12345 of 2026')).toBe('order 12345 of 2026'); // short numbers stay
  });
  it('truncation never splits a character outside the BMP', () => {
    const text = 'word '.repeat(98) + '\u{1F600}\u{1F600}\u{1F600}';
    const out = scrubMessage(text);
    expect(Array.from(out).length).toBeLessThanOrEqual(500);
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/); // no lone surrogate
    expect(() => JSON.parse(JSON.stringify(out))).not.toThrow();
  });
  it('an email or address in a path segment is scrubbed too', () => {
    expect(scrubPath('/u/ana@example.com/profile')).toBe('/u/[email]/profile');
    expect(scrubPath('/ip/203.0.113.9')).toBe('/ip/[ip]');
    expect(scrubPath('/en/topic/trig-radians')).toBe('/en/topic/trig-radians');
  });
  it('a path keeps its shape and loses query, fragment, host and secrets', () => {
    expect(scrubPath('/en/topic/trig?x=ana@example.com#top')).toBe('/en/topic/trig');
    expect(scrubPath('https://site.test/ur/search?q=secret')).toBe('/ur/search');
    expect(scrubPath('/reset/' + 'A1b2C3d4'.repeat(5))).toBe('/reset/[token]');
    expect(scrubPath('relative/path')).toBe('/');
    expect(scrubPath(42)).toBe('/');
    expect(scrubPath('javascript:alert(1)')).toBe('/');
    expect(scrubPath('/a'.repeat(300)).length).toBeLessThanOrEqual(200);
    expect(scrubPath('/café')).toBe('/caf?');
  });
});
