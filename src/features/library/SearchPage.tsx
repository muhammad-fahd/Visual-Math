'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LEVELS, formatSearchAddress, loc, parseSearchAddress, searchTopics, treeHref, type SearchData, type SearchState } from '../../lib/library';
import { TreeList } from './TreeList';
import { SearchResults } from './SearchResults';

// The search page (Story 5.3, FR-1.4, 1.5, AD-21). Everything runs in the browser over the data the page carries, so
// no request is made while typing. The text, the category chips and the level chips live in the address (`q`, `cat`,
// `level`): a shared link or Back restores them. Search runs on Enter or after a 400 ms pause; the count is announced.

const PAUSE_MS = 400;

export function SearchPage({ data }: { data: SearchData }) {
  const t = useTranslations('search');
  const all = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const fieldId = useId();
  const initial = useMemo(() => parseSearchAddress(params), [params]);
  const [text, setText] = useState(initial.q);
  const [state, setState] = useState<SearchState>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The address is the one place the state is kept between visits: write it without adding history entries.
  useEffect(() => {
    const query = formatSearchAddress(state);
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, '', url);
  }, [state]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (q: string) => {
    clearTimeout(timer.current);
    setState((s) => (s.q === q ? s : { ...s, q }));
  };
  const onText = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), PAUSE_MS);
  };
  // A chip also takes the text typed so far, so the answer and the address never lag behind what the visitor sees.
  const toggle = <K extends 'cats' | 'levels'>(key: K, value: SearchState[K][number]) => {
    clearTimeout(timer.current);
    setState((s) => {
      const list = s[key] as string[];
      const next = list.includes(value as string) ? list.filter((x) => x !== value) : [...list, value as string];
      return { ...s, q: text, [key]: next } as SearchState;
    });
  };

  const results = useMemo(() => searchTopics(data, state), [data, state]);
  const filtered = state.cats.length > 0 || state.levels.length > 0;
  const withTopics = data.categories.filter((c) => c.count > 0);

  const chip = (on: boolean, label: string, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1 rounded-sm border-2 px-3 font-semibold text-text ${on ? 'border-primary bg-selected' : 'border-border-strong bg-surface'}`}
      data-chip={key}
    >
      {on ? <span aria-hidden="true">✓</span> : null}
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6" data-search-page="">
      <form
        role="search"
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          commit(text);
        }}
      >
        <label htmlFor={fieldId} className="sr-only">
          {t('field')}
        </label>
        <input
          id={fieldId}
          type="search"
          name="q"
          value={text}
          onChange={(e) => onText(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-full border-2 border-border-strong bg-surface px-4 text-text"
          data-search-field=""
        />
        {text !== '' ? (
          <button
            type="button"
            onClick={() => {
              setText('');
              commit('');
            }}
            className="inline-flex min-h-11 items-center text-link underline"
            data-clear-text=""
          >
            {t('clear')}
          </button>
        ) : null}
      </form>

      <div className="flex flex-col gap-3">
        <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
          <legend className="mb-2 font-semibold">{t('categoryGroup')}</legend>
          {withTopics.map((c) => chip(state.cats.includes(c.category), loc(c.name, locale), () => toggle('cats', c.category), c.category))}
        </fieldset>
        <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
          <legend className="mb-2 font-semibold">{t('levelGroup')}</legend>
          {LEVELS.map((l) => chip(state.levels.includes(l), all(`topic.level.${l}`), () => toggle('levels', l), l))}
        </fieldset>
        {filtered ? (
          <button type="button" onClick={() => setState((s) => ({ ...s, q: text, cats: [], levels: [] }))} className="inline-flex min-h-11 w-fit items-center text-link underline" data-clear-filters="">
            {t('clearFilters')}
          </button>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="m-0 font-semibold" data-count={results.length}>
        {results.length === 0 ? t('none') : t('found', { count: results.length })}
      </p>

      {results.length > 0 ? (
        <SearchResults entries={results} />
      ) : (
        <section className="flex flex-col gap-3" data-no-results="">
          <p className="m-0">{t('noResultsBody')}</p>
          <h2 className="m-0 text-xl font-semibold">{t('browse')}</h2>
          <TreeList nodes={data.categories} />
          <Link href={treeHref(locale)} className="inline-flex min-h-11 items-center text-link underline">
            {all('library.home')}
          </Link>
        </section>
      )}
    </div>
  );
}
