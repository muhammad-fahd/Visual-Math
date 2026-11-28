import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { TopicPage } from '../../../../features/topic';
import { categoryNode, chapterNeighbours, chapterNode, linkedTopics, loc, subcategoryNode, topicById, topicHref, type Loc } from '../../../../lib/library';
import type { CatalogTopic } from '../../../../lib/topic-schema/catalog';
import { getCatalog } from '../../../../server/catalog-source';
import { loadTopic } from '../../../../server/topic-source';

// A topic by its direct link (Story 5.4, FR-1.6, 1.8, 1.9): /{locale}/topic/{id}, no login, in the link's language.
// Only a published topic opens; anything else is the friendly not-found page. Static per locale: known ids are generated
// at build, the rest render on demand. The step and slider values in the address are read in the browser, not here.

type Params = { locale: string; id: string };

export async function generateStaticParams() {
  return (await getCatalog()).topics.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, id } = await params;
  const topic = await loadTopic(id);
  const t = await getTranslations('site');
  if (!topic) return { title: t('name') };
  return { title: `${loc(topic.title, locale)} | ${t('name')}`, description: loc(topic.summary, locale) };
}

export default async function TopicRoute({ params }: { params: Promise<Params> }) {
  const { locale, id } = await params;
  const topic = await loadTopic(id);
  if (!topic) notFound();
  const catalog = await getCatalog();
  // Where the topic sits comes from the tree (the same placement the lists and neighbours use), not from the stored
  // document, whose own path can be stale after the admin moves the topic.
  const { category, subcategory, chapter } = topicById(catalog, id)?.path ?? topic.path;
  const link = (t: CatalogTopic) => ({ title: t.title as Loc, href: topicHref(locale, t.id) });
  const { previous, next } = chapterNeighbours(catalog, id);
  return (
    <TopicPage
      topic={topic}
      names={{
        category: categoryNode(catalog, category)?.name,
        subcategory: subcategoryNode(catalog, category, subcategory)?.name,
        chapter: chapterNode(catalog, category, subcategory, chapter)?.name,
      }}
      previous={previous ? link(previous) : undefined}
      next={next ? link(next) : undefined}
      prerequisites={linkedTopics(catalog, topic.prerequisites, id).map(link)}
      upNext={linkedTopics(catalog, topic.next, id).map(link)}
    />
  );
}
