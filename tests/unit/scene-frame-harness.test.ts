import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The harness page of the scene frame exists only on the test server (VM_HARNESS=1). In production
// the variable is never set, so the page must be a 404.

afterEach(() => vi.unstubAllEnvs());

describe('the frame harness is not part of the site', () => {
  it('without VM_HARNESS the page is a 404', async () => {
    vi.stubEnv('VM_HARNESS', '');
    const { default: Harness } = await import('../../src/app/[locale]/dev/frame/page');
    await expect(Harness({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404') });
  });
  it.each(['0', 'true', 'yes', ' 1', '1 ', 'on'])('only the exact value 1 turns it on (%j is still a 404)', async (value) => {
    vi.stubEnv('VM_HARNESS', value);
    const { default: Harness } = await import('../../src/app/[locale]/dev/frame/page');
    await expect(Harness({ searchParams: Promise.resolve({}) })).rejects.toBeDefined();
  });
  it('with VM_HARNESS=1 it renders, and an unknown mode falls back to 3d', async () => {
    vi.stubEnv('VM_HARNESS', '1');
    const { default: Harness } = await import('../../src/app/[locale]/dev/frame/page');
    const element = (await Harness({ searchParams: Promise.resolve({ mode: 'sideways' }) })) as { props: { mode: string; describe: boolean } };
    expect(element.props.mode).toBe('3d');
    expect(element.props.describe).toBe(true);
    const flat = (await Harness({ searchParams: Promise.resolve({ mode: '2d', desc: '0' }) })) as { props: { mode: string; describe: boolean } };
    expect(flat.props).toMatchObject({ mode: '2d', describe: false });
  });
  it('the page decides per request: it is dynamic, so a build without the variable cannot bake a 404 in', () => {
    const text = readFileSync('src/app/[locale]/dev/frame/page.tsx', 'utf8');
    expect(text).toContain("export const dynamic = 'force-dynamic'");
    expect(text).toMatch(/process\.env\.VM_HARNESS !== '1'/);
  });
  it('VM_HARNESS appears only in the page, the harness, their tests, the docs and the Playwright configuration (the one place that sets it)', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.git', '_bmad', 'test-results', 'playwright-report'].includes(name) || name.startsWith('.next')) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|mjs|js|json|yml|yaml|md|toml)$/.test(name) && /VM_HARNESS/.test(readFileSync(full, 'utf8'))) hits.push(full.split(sep).join('/'));
      }
    };
    walk('.');
    expect(hits.map((f) => `./${f}`.replace('././', './')).filter((f) => !f.startsWith('./_bmad-output/')).sort()).toEqual(
      [
        './content/fixtures/tree.json',
        './docs/coding-standard.md',
        './docs/environments.md',
        './docs/spikes.md',
        './playwright.config.ts',
        './src/app/[locale]/dev/frame/page.tsx',
        './src/app/[locale]/dev/home/page.tsx',
        './src/app/[locale]/dev/map/page.tsx',
        './src/app/[locale]/dev/search/page.tsx',
        './src/app/[locale]/dev/solid/page.tsx',
        './src/app/[locale]/dev/topic/page.tsx',
        './src/features/dev/FrameHarness.tsx',
        './src/server/catalog-source.ts',
        './src/server/fixture-catalog.ts',
        './src/server/topic-source.ts',
        './tests/e2e/graph.spec.ts',
        './tests/e2e/home.spec.ts',
        './tests/e2e/map.spec.ts',
        './tests/e2e/library.spec.ts',
        './tests/e2e/algebra.spec.ts',
        './tests/e2e/calculus.spec.ts',
        './tests/e2e/complex.spec.ts',
        './tests/e2e/geometry.spec.ts',
        './tests/e2e/models.spec.ts',
        './tests/e2e/search.spec.ts',
        './tests/e2e/scene-frame.spec.ts',
        './tests/e2e/trig.spec.ts',
        './tests/e2e/solid.spec.ts',
        './tests/e2e/space.spec.ts',
        './tests/e2e/stats.spec.ts',
        './tests/e2e/topic-link.spec.ts',
        './tests/e2e/topic.spec.ts',
        './tests/unit/catalog-port.test.ts',
        './tests/unit/scene-frame-harness.test.ts',
        './tests/unit/solid-topic.test.ts',
        './tests/unit/topic-harness.test.ts',
        './tests/unit/topic-link.test.ts',
      ].sort(),
    );
    // No deployment configuration, script or workflow turns it on.
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow).not.toContain('VM_HARNESS');
    expect(readFileSync('package.json', 'utf8')).not.toContain('VM_HARNESS');
    expect(readFileSync('.env.example', 'utf8')).not.toContain('VM_HARNESS');
  });
});
