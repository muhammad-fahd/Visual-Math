import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LibraryPage, TreeList } from '../../../../features/library';
import { categoryNode, chapters, loc, subcategoryNode, treeHref } from '../../../../lib/library';
import { getCatalog } from '../../../../server/catalog-source';

// A subcategory (FR-1.2): its name, the number of topics inside, and its chapters.

type Params = { locale: string; category: string; subcategory: string };


export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.tree.filter((n) => n.subcategory !== null && n.chapter === null).map((n) => ({ category: n.category, subcategory: n.subcategory! }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, category, subcategory } = await params;
  const node = subcategoryNode(await getCatalog(), category, subcategory);
  const t = await getTranslations('site');
  return { title: node ? `${loc(node.name, locale)} | ${t('name')}` : t('name') };
}

export default async function SubcategoryPage({ params }: { params: Promise<Params> }) {
  const { locale, category, subcategory } = await params;
  const catalog = await getCatalog();
  const node = subcategoryNode(catalog, category, subcategory);
  const parent = categoryNode(catalog, category);
  if (!node || !parent) notFound();
  const t = await getTranslations('library');
  const children = chapters(catalog, category, subcategory);
  return (
    <LibraryPage
      trail={[
        { slug: 'home', name: t('home'), href: treeHref(locale) },
        { slug: category, name: loc(parent.name, locale), href: treeHref(locale, category) },
      ]}
      title={loc(node.name, locale)}
      count={node.count}
      heading={t('chapters')}
    >
      {children.length > 0 ? <TreeList nodes={children} /> : <p className="m-0">{t('emptyBranch')}</p>}
    </LibraryPage>
  );
}
