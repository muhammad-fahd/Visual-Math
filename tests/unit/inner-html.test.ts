import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// AD-14: `dangerouslySetInnerHTML` appears only in `MathHtml` (KaTeX markup from `renderMath`) and in the
// three places that write the pre-paint script, whose text is a constant of this repository.

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

describe('dangerouslySetInnerHTML', () => {
  const hits = walk('src')
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'))
    .map((f) => f.replaceAll('\\', '/'))
    .sort();
  it('is used only by MathHtml and the pre-paint script of the three layouts', () => {
    expect(hits).toEqual(['src/app/[locale]/layout.tsx', 'src/app/admin/layout.tsx', 'src/app/global-not-found.tsx', 'src/features/scene/MathHtml.tsx']);
  });
  it('the pre-paint uses hold a constant, never a value from a topic or a visitor', () => {
    for (const f of hits.filter((h) => h !== 'src/features/scene/MathHtml.tsx')) expect(readFileSync(f, 'utf8')).toContain('__html: PREPAINT_SCRIPT');
  });
  it('MathHtml gets its markup only from renderMath', () => {
    const text = readFileSync('src/features/scene/MathHtml.tsx', 'utf8');
    expect(text).toContain("from '../../lib/text'");
    expect(text.match(/__html:/g)).toHaveLength(1);
    expect(text).toContain('__html: html');
    expect(text).toContain('renderMath(latex');
  });
});
