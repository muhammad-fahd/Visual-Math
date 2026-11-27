import katex from 'katex';

// The one way math becomes markup (AD-14): upload checks, the server render and the browser all use
// this and this one options object. Never an author's string as HTML: the input is LaTeX that has
// passed `fillFormula`, and KaTeX is configured not to trust it.

export const MATH_OPTIONS = Object.freeze({
  trust: false,
  strict: 'error',
  throwOnError: true,
  maxSize: 20,
  maxExpand: 200,
  output: 'htmlAndMathml',
  // KaTeX does not throw for a command it refuses under `trust: false` (\href, \def, \includegraphics ...);
  // it draws the command name in this color instead. A color nothing else uses lets `renderMath` see that.
  errorColor: 'rgb(1, 2, 3)',
} as const);

const REFUSED = /rgb\(1,\s*2,\s*3\)/;

/** KaTeX markup for `latex` (HTML plus MathML), or `null` when KaTeX refuses it. */
export function renderMath(latex: string, options: { inline: boolean }): string | null {
  try {
    const html = katex.renderToString(latex, { ...MATH_OPTIONS, displayMode: !options.inline });
    return REFUSED.test(html) ? null : html;
  } catch {
    return null;
  }
}

/** The formula as plain text for `aria-label`s and search: no markup, placeholders left as they are. */
export function plainMath(latex: string): string {
  return latex
    .replace(/\\(?:dfrac|tfrac|frac)\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\(?:times|cdot)/g, '×')
    .replace(/\\pi/g, 'π')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/[\\{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
