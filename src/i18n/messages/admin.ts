import adminEn from './admin.en.json';

// The admin area is English only (one admin), but its text still lives in a message file, not in code.
export const adminText = adminEn;

/** Fills `{name}` placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}
