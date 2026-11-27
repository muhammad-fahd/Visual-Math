import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { SolidViewer, type SolidTopic } from '../../src/features/scene';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';

// The server render of the viewer (what is in the HTML before any script runs), and a topic whose
// numbers cannot be computed: the page must still render, with a dash and "undefined", never an error.

const cone = () => JSON.parse(readFileSync('content/fixtures/geo-cone-volume.json', 'utf8')) as SolidTopic;
const html = (topic: SolidTopic, locale: 'en' | 'ur' = 'en') =>
  renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(SolidViewer, { topic }) }));

describe('the server render of the solid viewer', () => {
  const out = html(cone());
  it('has the sliders, the typed boxes, the readout and the formulas, and no 3D canvas', () => {
    expect(out).toContain('id="param-r"');
    expect(out).toContain('id="param-h"');
    expect(out).toContain('data-typed="r"');
    expect(out).toContain('data-readout="volume"');
    expect(out).toContain('94.2');
    expect(out).toContain('katex');
    expect(out).not.toContain('<canvas');
  });
  it('does not pick a tier on the server: the device decides after it loads', () => {
    expect(out).toContain('data-tier="pending"');
    expect(out).toContain('Loading the 3D picture');
  });
  it('carries no tier message, no offer and no stored choice', () => {
    expect(out).not.toContain('tier-message');
    expect(out).not.toContain('tier-offer');
    expect(out).not.toContain('vm.tier');
  });
  it('is in the visitor\'s language, with the picture kept left to right', () => {
    const urdu = html(cone(), 'ur');
    expect(urdu).toContain('رداس');
    expect(urdu).toContain('dir="ltr"');
  });
});

describe('numbers that cannot be computed (the matrix row "formula undefined")', () => {
  const broken = (): SolidTopic => {
    const t = cone();
    t.derived = [
      { id: 'vol', expr: '1 / 0' },
      { id: 'slant', expr: 'sqrt(r^2 + h^2)' },
    ];
    return t;
  };
  it('renders: the readout is a dash and the formula says undefined, with no throw', () => {
    let out = '';
    expect(() => (out = html(broken()))).not.toThrow();
    expect(out).toContain('data-readout="volume"');
    expect(out).toMatch(/data-readout="volume"[^>]*>—/);
    expect(out).toContain('undefined');
    expect(out).toContain('10.4'); // the other formula is unaffected
  });
  it('a dimension that is undefined leaves a solid on the screen, not a crash', () => {
    const t = cone();
    t.scene.solid.dims = { radius: '1 / 0', height: 'nope' };
    expect(() => html(t)).not.toThrow();
  });
  it('a hostile expression in a dimension, a readout or a formula binding is NaN, not code', () => {
    const t = cone();
    t.scene.solid.dims = { radius: 'constructor', height: '__proto__' };
    t.formulas[0]!.bind = { r: { expr: 'process', decimals: 1 }, h: { expr: 'this', decimals: 1 }, v: { expr: 'x(', decimals: 1 } };
    expect(() => html(t)).not.toThrow();
  });
});

describe('the optional fields of Story 2.5 in the server render', () => {
  const load = (id: string) => JSON.parse(readFileSync(`content/fixtures/${id}.json`, 'utf8')) as SolidTopic;
  it('a cylinder with a net lists its parts, which add up, and offers Unfold and Fold', () => {
    const out = html(load('geo-cylinder-net'));
    expect(out).toContain('data-testid="net-parts"');
    expect(out).toMatch(/data-part="total"[^>]*>150\.8/);
    expect(out).toContain('Unfold');
    expect(out).toContain('Fold');
  });
  it('a net the solid cannot have (a sphere) shows no parts and no Play', () => {
    const t = load('geo-cylinder-net');
    t.scene.solid = { kind: 'sphere', dims: { radius: 'r' } };
    const out = html(t);
    expect(out).not.toContain('net-parts');
    expect(out).not.toContain('data-testid="play"');
  });
  it('a progress that is an expression, not a bare parameter, has no Play buttons but still unfolds', () => {
    const t = load('geo-cylinder-net');
    t.scene.net = { progress: 'u * 1' };
    const out = html(t);
    expect(out).toContain('net-parts');
    expect(out).not.toContain('data-testid="play"');
  });
  it('a section that is off draws no panel; one that misses says so; one that cuts names the shape', () => {
    const t = load('geo-cone-section');
    t.scene.section = { enabled: 0, plane: { axis: 'y', offset: 'cut' } };
    expect(html(t)).not.toContain('data-testid="section"');
    t.scene.section = { enabled: 1, plane: { axis: 'y', offset: 99 } };
    expect(html(t)).toContain('does not touch the solid');
    t.scene.section = { enabled: 1, plane: { axis: 'y', offset: 0 } };
    const cut = html(t);
    expect(cut).toContain('data-section-shape="circle"');
    expect(cut).toMatch(/data-measure="radius"[^>]*>1\.5/);
  });
  it('a fill shows its share, and Play for it', () => {
    const out = html(load('geo-cylinder-fill'));
    expect(out).toContain('data-fill-share="33"');
    expect(out).toContain('Pour in');
  });
  it('a hostile plane, net or fill (NaN, text that is not an expression) renders without a throw', () => {
    const t = load('geo-cylinder-fill');
    t.scene.fill = { level: 'constructor' };
    t.scene.net = { progress: '1 +' };
    t.scene.section = { enabled: 'nope', normal: ['__proto__', 0, 0], d: 'x(' };
    expect(() => html(t)).not.toThrow();
  });
});
