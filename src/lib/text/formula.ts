import { format } from '../expr';

// `{{name}}` placeholders in a formula's LaTeX (topic-format 1.3, AD-14). A placeholder is replaced
// only by text that matches `^-?\d+(\.\d+)?$` (shown with a real minus sign) or by the code-inserted
// `\text{undefined}`; anything else, and any name that is not bound, becomes a dash. So a value can
// never carry LaTeX into the formula.

export interface Bound {
  readonly value: number;
  readonly decimals: number;
}

const PLACEHOLDER = /\{\{([a-z][a-zA-Z0-9]{0,15})\}\}/g;
const SAFE_NUMBER = /^-?\d+(\.\d+)?$/;
const MINUS = '−';
const UNDEFINED = '\\text{undefined}';
const DASH = '\\text{--}';

export function fillFormula(latex: string, bound: Readonly<Record<string, Bound>>): string {
  return latex.replace(PLACEHOLDER, (_all, name: string) => {
    if (!Object.hasOwn(bound, name)) return DASH;
    const b = bound[name]!;
    if (typeof b.value !== 'number' || !Number.isFinite(b.value)) return UNDEFINED;
    const shown = format(b.value, b.decimals);
    const ascii = shown.replace(MINUS, '-');
    if (!SAFE_NUMBER.test(ascii)) return DASH;
    return ascii.startsWith('-') ? `${MINUS}${ascii.slice(1)}` : ascii;
  });
}
