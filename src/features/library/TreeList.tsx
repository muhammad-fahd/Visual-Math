import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { loc, treeHref } from '../../lib/library';
import type { TreeNode } from '../../lib/topic-schema/catalog';

// The children of one tree level as links, each with its name and the number of topics inside (FR-1.2), for
// example "Geometry (12 topics)". A branch with no topic yet is still listed, with its count of zero.

export function TreeList({ nodes }: { nodes: readonly TreeNode[] }) {
  const t = useTranslations('library');
  const locale = useLocale();
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0" data-tree-list="">
      {nodes.map((n) => (
        <li key={`${n.category}/${n.subcategory ?? ''}/${n.chapter ?? ''}`}>
          <Link
            href={treeHref(locale, n.category, n.subcategory, n.chapter)}
            className="flex min-h-11 flex-wrap items-center gap-x-3 rounded-md border border-border bg-surface px-4 py-2 text-text no-underline"
            data-tree-link={n.chapter ?? n.subcategory ?? n.category}
          >
            <span className="text-xl font-semibold">{loc(n.name, locale)}</span>
            <span className="text-muted" data-count={n.count}>
              {`(${t('topicCount', { count: n.count })})`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
