import { format } from '../expr';

// `{{name}}` in a worked example's text (topic-format 1.4): the live value of an input or a calculated
// line, formatted with its decimals, Western digits, a real minus sign; a name that is not known, and a
// value that cannot be computed, become a dash. Text only: the result is never markup.

export interface Shown {
  readonly value: number;
  readonly decimals: number;
}

const PLACEHOLDER = /\{\{([a-z][a-zA-Z0-9]{0,15})\}\}/g;

export function fillText(text: string, values: Readonly<Record<string, Shown>>): string {
  return text.replace(PLACEHOLDER, (_all, name: string) => (Object.hasOwn(values, name) ? format(values[name]!.value, values[name]!.decimals) : '—'));
}

/** How many decimals a typed step needs: 0.5 gives 1, 0.25 gives 2, 1 gives 0. */
export function decimalsOfStep(step: number): number {
  if (!Number.isFinite(step) || Number.isInteger(step)) return 0;
  const text = String(step);
  if (text.includes('e-')) return Math.min(6, Number(text.split('e-')[1]));
  return Math.min(6, text.split('.')[1]?.length ?? 0);
}
