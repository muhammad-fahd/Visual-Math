import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { categories as categoryNodes, featuredTopics, loc, startTopic, topicHref, treeHref } from '../../lib/library';
import { plainText } from '../../lib/text';
import type { Catalog } from '../../lib/topic-schema/catalog';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { ThemeToggle } from '../theme/ThemeToggle';
import { SearchBox } from './SearchBox';
import { TopicCard } from './TopicCard';
import { TreeList } from './TreeList';

// Home (Story 5.2, FR-1.1): three lines about Visual Math, the search box, Start, the 12 categories with their topic
// counts, and the featured topics. Static server HTML for every visitor; nothing here asks for an account. Featured
// topics and Start are derived from the catalog (`featuredTopics`, `startTopic`), so there is nothing to maintain.
export function HomePage({ catalog }: { catalog: Catalog }) {
  const t = useTranslations('home');
  const locale = useLocale();
  const start = startTopic(catalog);
  const featured = featuredTopics(catalog);
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-4" data-home="">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <header className="flex flex-col gap-3">
        <h1 className="m-0 text-4xl font-bold">{t('title')}</h1>
        <p className="m-0 text-xl">{t('line1')}</p>
        <p className="m-0">{t('line2')}</p>
        <p className="m-0 text-muted">{t('line3')}</p>
      </header>
      <SearchBox />
      <div className="flex flex-col gap-2" data-start="">
        {start ? (
          <>
            <Link
              href={topicHref(locale, start.id)}
              className="inline-flex min-h-12 w-fit items-center rounded-md border-2 border-primary bg-primary px-6 text-lg font-semibold text-on-primary no-underline"
              data-start-link={start.id}
            >
              {t('start')}
            </Link>
            <p className="m-0 text-muted">{t('startFirst', { title: plainText(loc(start.title, locale)) })}</p>
          </>
        ) : (
          <p className="m-0" data-coming-soon="">
            {t('comingSoon')}
          </p>
        )}
      </div>
      <p className="m-0">
        <Link href={treeHref(locale, 'map')} className="inline-flex min-h-11 items-center text-link underline" data-map-link="">
          {t('mapLink')}
        </Link>
      </p>
      <section className="flex flex-col gap-3" aria-labelledby="home-categories">
        <h2 id="home-categories" className="m-0 text-2xl font-semibold">
          {t('categories')}
        </h2>
        <TreeList nodes={categoryNodes(catalog)} />
      </section>
      {featured.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="home-featured" data-featured="">
          <h2 id="home-featured" className="m-0 text-2xl font-semibold">
            {t('featured')}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {featured.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
