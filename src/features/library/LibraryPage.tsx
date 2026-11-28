import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { PathLinks, type PathPart } from '../topic/PathLinks';

// The frame of a tree page (category, subcategory, chapter): where you are, the name, how many topics are inside,
// and the list. Static server HTML; the language switcher is the only client piece besides the viewed marks.

export function LibraryPage({ trail, title, count, heading, children }: { trail: readonly PathPart[]; title: string; count: number; heading?: string; children: ReactNode }) {
  const t = useTranslations('library');
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4" data-library-page="">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PathLinks parts={trail} current={title} />
        <LanguageSwitcher />
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-3xl font-bold">{title}</h1>
        <p className="m-0 text-muted" data-total={count}>
          {t('topicCount', { count })}
        </p>
      </header>
      {heading ? <h2 className="m-0 text-xl font-semibold">{heading}</h2> : null}
      {children}
    </main>
  );
}
