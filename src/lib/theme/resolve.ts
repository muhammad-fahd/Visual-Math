// Pure theme logic shared by the pre-paint script's tests and the toggle (AD-11).
export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'vm.theme';
export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

/** Anything that is not a known choice (missing, corrupt, blocked storage) means "follow the system". */
export function parseChoice(value: unknown): ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}
