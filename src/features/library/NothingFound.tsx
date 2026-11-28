import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { treeHref } from '../../lib/library';
import type { TreeNode } from '../../lib/topic-schema/catalog';
import { SearchBox } from './SearchBox';
import { TreeList } from './TreeList';

// The friendly page for a link or a search that finds nothing (FR-1.10): what happened, a way to try again (the
// search box), a way to browse (the categories) and a way home. `children` is where the caller puts its own way back.
export function NothingFound({ categories, children }: { categories: readonly TreeNode[]; children?: ReactNode }) {
  const t = useTranslations('library');
  const locale = useLocale();
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4" data-not-found="">
      <h1 className="m-0 text-3xl font-bold">{t('notFoundTitle')}</h1>
      <p className="m-0">{t('notFoundBody')}</p>
      <SearchBox />
      {categories.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-xl font-semibold">{t('nothingBrowse')}</h2>
          <TreeList nodes={categories} />
        </section>
      ) : null}
      <div className="flex flex-wrap gap-4">
        {children}
        <Link href={treeHref(locale)} className="inline-flex min-h-11 items-center text-link underline" data-home-link="">
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
