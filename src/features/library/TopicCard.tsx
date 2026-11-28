import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { loc, topicHref } from '../../lib/library';
import { plainText } from '../../lib/text';
import type { CatalogTopic } from '../../lib/topic-schema/catalog';
import { ViewedMark } from '../progress';

// A topic card (UX topic-card, FR-1.3), its title an h3 under the page's "Topics" h2: title, short summary, level, minutes and, once viewed on this device, the
// "Viewed" mark. The whole card is one link to the topic. The level is a word, never color alone. Foundation cards
// are larger. The card is the same static HTML for everyone; only the viewed mark arrives after hydration.

export function TopicCard({ topic }: { topic: CatalogTopic }) {
  const t = useTranslations();
  const locale = useLocale();
  const foundation = topic.level === 'foundation';
  return (
    <li>
      <Link
        href={topicHref(locale, topic.id)}
        className={`flex flex-col gap-2 rounded-md border border-border bg-surface text-text no-underline ${foundation ? 'min-h-12 p-5' : 'min-h-11 p-4'}`}
        data-topic-card={topic.id}
      >
        <h3 className={`m-0 font-semibold ${foundation ? 'text-2xl' : 'text-xl'}`}>{plainText(loc(topic.title, locale))}</h3>
        <p className="m-0 text-muted">{plainText(loc(topic.summary, locale))}</p>
        <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="rounded-full border border-border-strong px-3" data-level={topic.level}>
            {t(`topic.level.${topic.level}`)}
          </span>
          <span>{t('topic.minutes', { n: topic.estimatedMinutes })}</span>
          <ViewedMark id={topic.id} />
        </p>
      </Link>
    </li>
  );
}
