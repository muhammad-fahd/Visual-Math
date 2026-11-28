import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LibraryPage, TopicCard } from '../../../../../features/library';
import { categoryNode, chapterNode, loc, subcategoryNode, topicsOf, treeHref } from '../../../../../lib/library';
import { getCatalog } from '../../../../../server/catalog-source';

// A chapter (FR-1.2, 1.3): its name, the number of topics inside, and its topic cards in reading order. Only
// published topics are in the catalog, so an unpublished or deleted one is not here (FR-1.9).

type Params = { locale: string; category: string; subcategory: string; chapter: string };


export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.tree.filter((n) => n.chapter !== null).map((n) => ({ category: n.category, subcategory: n.subcategory!, chapter: n.chapter! }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, category, subcategory, chapter } = await params;
  const node = chapterNode(await getCatalog(), category, subcategory, chapter);
  const t = await getTranslations('site');
  return { title: node ? `${loc(node.name, locale)} | ${t('name')}` : t('name') };
}

export default async function ChapterPage({ params }: { params: Promise<Params> }) {
  const { locale, category, subcategory, chapter } = await params;
  const catalog = await getCatalog();
  const node = chapterNode(catalog, category, subcategory, chapter);
  const cat = categoryNode(catalog, category);
  const sub = subcategoryNode(catalog, category, subcategory);
  if (!node || !cat || !sub) notFound();
  const t = await getTranslations('library');
  const topics = topicsOf(catalog, chapter);
  return (
    <LibraryPage
      trail={[
        { slug: 'home', name: t('home'), href: treeHref(locale) },
        { slug: category, name: loc(cat.name, locale), href: treeHref(locale, category) },
        { slug: subcategory, name: loc(sub.name, locale), href: treeHref(locale, category, subcategory) },
      ]}
      title={loc(node.name, locale)}
      count={node.count}
      heading={t('topics')}
    >
      {topics.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" data-topic-list="">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </ul>
      ) : (
        <p className="m-0">{t('emptyBranch')}</p>
      )}
    </LibraryPage>
  );
}
