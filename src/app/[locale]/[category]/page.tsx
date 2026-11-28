import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LibraryPage, TreeList } from '../../../features/library';
import { categoryNode, loc, subcategories, treeHref } from '../../../lib/library';
import { getCatalog } from '../../../server/catalog-source';

// A category (FR-1.2): its name, the number of topics inside, and its subcategories. Static per locale; the
// addresses known at build are generated, the others render on demand and answer 404 when the slug is not in the tree.

type Params = { locale: string; category: string };


export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.tree.filter((n) => n.subcategory === null).map((n) => ({ category: n.category }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, category } = await params;
  const node = categoryNode(await getCatalog(), category);
  const t = await getTranslations('site');
  return { title: node ? `${loc(node.name, locale)} | ${t('name')}` : t('name') };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { locale, category } = await params;
  const catalog = await getCatalog();
  const node = categoryNode(catalog, category);
  if (!node) notFound();
  const t = await getTranslations('library');
  const children = subcategories(catalog, category);
  return (
    <LibraryPage trail={[{ slug: 'home', name: t('home'), href: treeHref(locale) }]} title={loc(node.name, locale)} count={node.count} heading={t('subcategories')}>
      {children.length > 0 ? <TreeList nodes={children} /> : <p className="m-0">{t('emptyBranch')}</p>}
    </LibraryPage>
  );
}
