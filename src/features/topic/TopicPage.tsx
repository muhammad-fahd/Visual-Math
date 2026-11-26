'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { ParamSpec } from '../../lib/params';
import { sceneAtStep } from '../../lib/params/steps';
import type { Topic } from '../../lib/topic-schema';
import type { Camera } from '../../scenes/frame';
import { SolidViewer, type SolidScene, type SolidTopic, type ViewerStep } from '../scene';
import { PathLinks, type PathPart } from './PathLinks';
import { ReportProblem } from './ReportProblem';
import { RichText } from './RichText';
import { StepBar } from './StepBar';
import { WorkedExample } from './WorkedExample';

// The topic page (Story 2.6, FR-2.1 to 2.3, 4.2 to 4.7, UX-DR7), laid out as SRS 7.2: on a laptop the
// picture fills the left two thirds and the right third holds the step, the sliders and the formulas; on
// a phone the picture sticks to the top while the page scrolls and the sliders sit directly under it. The
// layout is CSS only, so it mirrors in Urdu by itself; the picture, formulas and numbers keep left to right.

type Loc = Record<string, string>;
const loc = (text: Loc | undefined, locale: string): string => text?.[locale] ?? text?.['en'] ?? '';

export interface Neighbour {
  title: Loc;
  href: string;
}

export interface TopicPageProps {
  topic: Topic;
  /** Where the path links go; the tree pages (Epic 5) decide the real addresses. */
  hrefs?: { category?: string; subcategory?: string; chapter?: string };
  /** The names of the path from the tree; a slug is shown readable without them. */
  names?: { category?: Loc; subcategory?: Loc; chapter?: Loc };
  previous?: Neighbour;
  next?: Neighbour;
}

const SOLID = 'solid3d';

export function TopicPage({ topic, hrefs, names, previous, next }: TopicPageProps) {
  const t = useTranslations('topic');
  const locale = useLocale();
  // The step belongs to the topic it was chosen in: a different topic starts at step 1, and an index is never past the end.
  const [position, setPosition] = useState({ id: topic.id, index: 0 });
  const last = Math.max(0, topic.steps.length - 1);
  const index = position.id === topic.id ? Math.min(Math.max(0, position.index), last) : 0;
  const setIndex = (i: number) => setPosition({ id: topic.id, index: i });

  const terms = useMemo(() => Object.fromEntries((topic.terms ?? []).map((term) => [term.id, loc(term.term, locale)])), [topic.terms, locale]);
  const specs = useMemo<ParamSpec[]>(() => topic.parameters.map((p) => ({ id: p.id, min: p.min, max: p.max, step: p.step, default: p.default, kind: p.kind })), [topic.parameters]);
  const scene = topic.scene as SolidScene & { type?: string };
  const hasPicture = scene?.type === SOLID;

  const at = useMemo(() => sceneAtStep(topic.steps, index, specs), [topic.steps, index, specs]);
  const step = useMemo<ViewerStep>(() => ({ index, params: at.params, hidden: at.hidden, camera: at.camera as Camera | undefined }), [index, at]);
  const current = topic.steps[index];
  const solidTopic = useMemo<SolidTopic>(
    () => ({ title: topic.title, scene, parameters: topic.parameters, derived: topic.derived, formulas: topic.formulas }),
    [topic, scene],
  );

  const stepViews = useMemo(() => topic.steps.map((s) => ({ id: s.id, title: loc(s.title, locale), body: loc(s.body, locale) })), [topic.steps, locale]);
  const path: PathPart[] = [
    { slug: topic.path.category, name: names?.category ? loc(names.category, locale) : undefined, href: hrefs?.category ?? `/${locale}/${topic.path.category}` },
    { slug: topic.path.subcategory, name: names?.subcategory ? loc(names.subcategory, locale) : undefined, href: hrefs?.subcategory ?? `/${locale}/${topic.path.category}/${topic.path.subcategory}` },
    { slug: topic.path.chapter, name: names?.chapter ? loc(names.chapter, locale) : undefined, href: hrefs?.chapter ?? `/${locale}/${topic.path.category}/${topic.path.subcategory}/${topic.path.chapter}` },
  ];

  const stepBar = stepViews.length > 0 ? <StepBar steps={stepViews} index={index} onIndex={setIndex} terms={terms} /> : null;
  const backToPicture = (
    <a href="#scene" className="inline-flex min-h-11 items-center text-link underline lg:hidden" data-testid="back-to-picture">
      {t('backToPicture')}
    </a>
  );

  const layout = (parts: { picture: React.ReactNode; extras: React.ReactNode; controls: React.ReactNode; results: React.ReactNode; formulas: React.ReactNode; live: React.ReactNode }) => (
    // Phone: one column in this order (picture, sliders, cut and parts, step, results, formulas). Laptop: the left two
    // thirds hold the picture and what belongs to it, the right third holds the step, the sliders and the formulas.
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-8" data-testid="layout">
      <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
        <div
          id="scene"
          className="order-1 max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:max-h-[var(--vm-space-scene-ratio-phone)] max-lg:overflow-y-auto max-lg:bg-bg lg:order-none lg:sticky lg:top-4 [@media(max-height:40rem)]:static [@media(max-height:40rem)]:max-h-none [@media(max-width:22.5rem)]:static [@media(max-width:22.5rem)]:max-h-none"
          data-testid="scene-block"
        >
          {parts.picture}
        </div>
        <div className="order-3 flex flex-col gap-6 lg:order-none">{parts.extras}</div>
      </div>
      <div className="contents lg:col-span-1 lg:flex lg:flex-col lg:gap-6">
        <div className="order-4 lg:order-none lg:hidden">{backToPicture}</div>
        <div className="order-4 flex flex-col gap-6 lg:order-none">
          {stepBar}
        </div>
        <div className="order-2 lg:order-none">{parts.controls}</div>
        <div className="order-5 lg:order-none">{parts.results}</div>
        <div className="order-6 lg:order-none">{parts.formulas}</div>
        {parts.live}
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-4" data-testid="topic-page">
      <header className="flex flex-col gap-2">
        <PathLinks parts={path} current={loc(topic.title, locale)} />
        <h1 className="m-0 text-2xl font-bold">{loc(topic.title, locale)}</h1>
        <p className="m-0 text-muted">
          {t(`level.${topic.level}`)} · {t('minutes', { n: topic.estimatedMinutes })}
        </p>
        <p className="m-0">
          <RichText text={loc(topic.goal, locale)} terms={terms} />
        </p>
      </header>

      {hasPicture ? (
        <SolidViewer topic={solidTopic} step={step} highlight={current?.formulaRefs}>
          {layout}
        </SolidViewer>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="m-0 rounded-md border-2 border-hint p-3" data-testid="no-scene">
            {t('noScene')}
          </p>
          {stepBar}
        </div>
      )}

      <WorkedExample example={topic.example} terms={terms} />

      {topic.tryThis && topic.tryThis.length > 0 ? (
        <section aria-labelledby="try-title" data-testid="try-this">
          <h2 id="try-title" className="mb-2 text-xl font-semibold">
            {t('tryThis')}
          </h2>
          <ul className="m-0 flex list-disc flex-col gap-2 ps-6">
            {topic.tryThis.map((prompt, i) => (
              <li key={i}>
                <RichText text={loc(prompt, locale)} terms={terms} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topic.watchOut ? (
        <aside aria-labelledby="watch-title" className="rounded-md border-2 border-hint p-3" data-testid="watch-out">
          <h2 id="watch-title" className="m-0 flex items-center gap-2 text-xl font-semibold">
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 2 21h20L12 3zM12 10v5M12 18h.01" />
            </svg>
            {t('watchOut')}
          </h2>
          <p className="mb-0 mt-2">
            <RichText text={loc(topic.watchOut, locale)} terms={terms} />
          </p>
        </aside>
      ) : null}

      <div className="flex justify-end">
        <ReportProblem topicId={topic.id} />
      </div>

      <nav aria-label={t('neighbours')} className="flex flex-wrap items-center justify-between gap-3" data-testid="neighbours">
        {previous ? (
          <a href={previous.href} rel="prev" className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-border-strong bg-surface px-4 font-semibold text-text">
            <span aria-hidden="true" className="inline-block rtl:rotate-180">
              ←
            </span>
            <span>
              <span className="block text-sm font-normal text-muted">{t('previous')}</span>
              {loc(previous.title, locale)}
            </span>
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a href={next.href} rel="next" className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-primary bg-primary px-4 font-semibold text-on-primary">
            <span>
              <span className="block text-sm font-normal">{t('nextTopic')}</span>
              {loc(next.title, locale)}
            </span>
            <span aria-hidden="true" className="inline-block rtl:rotate-180">
              →
            </span>
          </a>
        ) : null}
      </nav>
    </main>
  );
}
