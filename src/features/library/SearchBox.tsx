import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { treeHref } from '../../lib/library';

// The search field (UX search-field). A plain GET form to /{locale}/search?q=: it works with no JavaScript, and the
// results page is Story 5.3. The field is required, so an empty search is not sent.
export function SearchBox() {
  const t = useTranslations('home');
  const locale = useLocale();
  const id = useId();
  return (
    <form action={treeHref(locale, 'search')} method="get" role="search" className="flex flex-wrap items-center gap-2" data-search-box="">
      <label htmlFor={id} className="sr-only">
        {t('searchLabel')}
      </label>
      <input
        id={id}
        type="search"
        name="q"
        required
        pattern=".*\S.*"
        title={t('searchLabel')}
        placeholder={t('searchHint')}
        className="min-h-11 min-w-0 flex-1 rounded-full border-2 border-border-strong bg-surface px-4 text-text"
      />
      <button type="submit" className="min-h-11 rounded-md border-2 border-primary bg-primary px-4 font-semibold text-on-primary">
        {t('searchButton')}
      </button>
    </form>
  );
}
