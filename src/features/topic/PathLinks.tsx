import { useTranslations } from 'next-intl';

// The path at the top of a topic page (FR-2.3): category, subcategory and chapter as links, then the topic
// itself as the current page. Names come from the tree when the page has them; a slug is shown readable.

export interface PathPart {
  slug: string;
  name?: string;
  href: string;
}

const readable = (slug: string) => {
  const words = slug.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function PathLinks({ parts, current }: { parts: readonly PathPart[]; current: string }) {
  const t = useTranslations('topic');
  return (
    <nav aria-label={t('path')}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-muted">
        {parts.map((p) => (
          <li key={p.slug} className="flex items-center gap-2">
            <a href={p.href} className="inline-flex min-h-11 items-center text-link underline">
              {p.name ?? readable(p.slug)}
            </a>
            <span aria-hidden="true" className="inline-block rtl:rotate-180">
              ›
            </span>
          </li>
        ))}
        <li aria-current="page" className="font-semibold text-text">
          {current}
        </li>
      </ol>
    </nav>
  );
}
