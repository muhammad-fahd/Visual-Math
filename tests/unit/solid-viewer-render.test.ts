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
