// One browserslist file is the source for build targets and the Playwright device matrix (AD-29).
// Limit: only `<browser> <version>` lines are supported, and Playwright runs its bundled engines, so the
// version numbers pick which browsers are tested but do not pin their versions. The floor versions
// (Chrome 111, Safari 16.4) are checked by the device spike and manual passes, not by this matrix.
export type MatrixProject = { name: string; browser: 'chromium' | 'firefox' | 'webkit'; channel?: string; mobile: boolean; width: number; height: number };

const MAP: Record<string, Omit<MatrixProject, 'name'>> = {
  chrome: { browser: 'chromium', mobile: false, width: 1280, height: 800 },
  edge: { browser: 'chromium', channel: 'msedge', mobile: false, width: 1280, height: 800 },
  firefox: { browser: 'firefox', mobile: false, width: 1280, height: 800 },
  safari: { browser: 'webkit', mobile: false, width: 1280, height: 800 },
  ios_saf: { browser: 'webkit', mobile: true, width: 390, height: 844 },
  samsung: { browser: 'chromium', mobile: true, width: 360, height: 740 },
};

export function matrixFromBrowserslist(text: string): MatrixProject[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [id] = l.split(/\s+/);
      const base = id ? MAP[id] : undefined;
      if (!base) throw new Error(`browserslist entry "${l}" has no Playwright mapping; add it to tests/playwright-matrix.ts`);
      return { name: l.replace(/\s+/g, '-'), ...base };
    });
}
