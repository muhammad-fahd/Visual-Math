import { useLocale, useTranslations } from 'next-intl';

// "What you need first" and "What to learn next" (FR-1.8): a short list of links to published topics. A prerequisite
// never locks anything: it is only a suggestion, and the topic below it is fully usable. Nothing renders for an empty list.

type Loc = Record<string, string>;
export interface TopicLink {
  title: Loc;
  href: string;
}

export function TopicLinks({ kind, links }: { kind: 'needFirst' | 'learnNext'; links: readonly TopicLink[] }) {
  const t = useTranslations('topic');
  const locale = useLocale();
  if (links.length === 0) return null;
  const id = `topic-${kind}`;
  return (
    <aside aria-labelledby={id} className="rounded-md border border-border bg-surface p-4" data-testid={kind === 'needFirst' ? 'prerequisites' : 'learn-next'}>
      <h2 id={id} className="m-0 text-xl font-semibold">
        {t(kind)}
      </h2>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="inline-flex min-h-11 items-center text-link underline">
              {l.title[locale] ?? l.title['en'] ?? ''}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
