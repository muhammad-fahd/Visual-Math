/* eslint-disable @typescript-eslint/no-explicit-any -- the tests read props of a React element */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The topic page harness exists only on the test server (VM_HARNESS=1). Anywhere else it is a 404, so the
// fixtures are never served in production.

afterEach(() => vi.unstubAllEnvs());

const args = (topic?: string, locale = 'en') => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(topic ? { topic } : {}) });

describe('the topic harness is not part of the site', () => {
  it('without VM_HARNESS, or with anything but exactly 1, the page is a 404', async () => {
    const { default: Harness } = await import('../../src/app/[locale]/dev/topic/page');
    for (const value of ['', 'true', '0', ' 1', '1 ', 'on']) {
      vi.stubEnv('VM_HARNESS', value);
      await expect(Harness(args()), JSON.stringify(value)).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404') });
    }
    vi.unstubAllEnvs();
    delete process.env.VM_HARNESS;
    await expect(Harness(args())).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404') });
  });
  it('with exactly 1 it renders the page for the chosen fixture, and odd values fall back to the cone', async () => {
    vi.stubEnv('VM_HARNESS', '1');
    const { default: Harness } = await import('../../src/app/[locale]/dev/topic/page');
    const titleOf = async (topic?: string) => ((await Harness(args(topic))) as any).props.topic.title.en as string;
    expect(await titleOf('section')).toBe('Cutting a Cone');
    expect(await titleOf('net')).toBe('The Net of a Cylinder');
    for (const odd of [undefined, 'nope', '__proto__', 'constructor', 'toString', '']) expect(await titleOf(odd)).toBe('The Volume of a Cone');
  });
  it('the neighbours are the other fixtures, in the visitor\'s language path, and none when bare', async () => {
    vi.stubEnv('VM_HARNESS', '1');
    const { default: Harness } = await import('../../src/app/[locale]/dev/topic/page');
    const el = (await Harness(args('net', 'ur'))) as any;
    expect(el.props.previous.href).toBe('/ur/dev/topic?topic=section');
    expect(el.props.next.href).toBe('/ur/dev/topic?topic=fill');
    const bare = (await Harness({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ topic: 'net', bare: '1' }) })) as any;
    expect(bare.props.previous).toBeUndefined();
    expect(bare.props.next).toBeUndefined();
  });
  it('it decides per request, so a build without the variable cannot bake a 404 in', () => {
    expect(readFileSync('src/app/[locale]/dev/topic/page.tsx', 'utf8')).toContain("export const dynamic = 'force-dynamic'");
  });
});
