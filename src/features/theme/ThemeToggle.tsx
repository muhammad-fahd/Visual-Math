'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { parseChoice, resolveTheme, THEME_CHOICES, THEME_KEY, type ThemeChoice } from '../../lib/theme/resolve';

/** The pre-paint script keeps the current choice on <html>; the toggle reads it, so it is correct on first paint. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-choice'] });
  return () => observer.disconnect();
}
const getSnapshot = (): ThemeChoice => parseChoice(document.documentElement.getAttribute('data-theme-choice'));
const getServerSnapshot = (): ThemeChoice => 'system';

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Applies a choice without a reload or a remount: storage plus the two attributes the CSS and the script read. */
function applyChoice(choice: ThemeChoice) {
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies for this page view and survives OS changes (script reads the attribute).
  }
  const root = document.documentElement;
  root.setAttribute('data-theme-choice', choice);
  root.setAttribute('data-theme', resolveTheme(choice, systemPrefersDark()));
}

export function ThemeToggle() {
  const t = useTranslations('theme');
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div role="group" aria-label={t('label')} className="inline-flex gap-2">
      {THEME_CHOICES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={choice === c}
          onClick={() => applyChoice(c)}
          className={
            'min-h-11 rounded-md border-2 px-4 font-semibold ' +
            (choice === c ? 'border-primary bg-selected text-text' : 'border-border-strong bg-surface text-text')
          }
        >
          {choice === c ? <span aria-hidden="true">{'✓ '}</span> : null}
          {t(c)}
        </button>
      ))}
    </div>
  );
}
