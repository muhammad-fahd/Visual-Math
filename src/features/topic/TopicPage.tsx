'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ParamSpec } from '../../lib/params';
import { mergeUrlState, parseUrlState } from '../../lib/params/url';
import { sceneAtStep } from '../../lib/params/steps';
import type { Topic } from '../../lib/topic-schema';
import type { Camera } from '../../scenes/frame';
import { viewerFor, type ViewerStep } from '../scene';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { PathLinks, type PathPart } from './PathLinks';
import { TopicLinks, type TopicLink } from './Prerequisites';
import { ReportProblem } from './ReportProblem';
import { ShareButton } from './ShareButton';
import { RichText } from './RichText';
import { StepBar } from './StepBar';
import { TermProvider } from './TermSheet';
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
  /** The published prerequisites and the published 'learn next' topics, as links (Story 5.4). Never a gate. */
  prerequisites?: TopicLink[];
  upNext?: TopicLink[];
}

export function TopicPage({ topic, hrefs, names, previous, next, prerequisites, upNext }: TopicPageProps) {
  const t = useTranslations('topic');
  const locale = useLocale();
  // The step belongs to the topic it was chosen in: a different topic starts at step 1, and an index is never past the end.
  const [position, setPosition] = useState({ id: topic.id, index: 0 });
  const last = Math.max(0, topic.steps.length - 1);
  const index = position.id === topic.id ? Math.min(Math.max(0, position.index), last) : 0;
  const setIndex = (i: number) => setPosition({ id: topic.id, index: i });
  const [resetSeq, setResetSeq] = useState(0);
  const [restore, setRestore] = useState<{ seq: number; params: Record<string, number> } | undefined>(undefined);
  const [changed, setChanged] = useState<Record<string, number>>({});
  const [resetSaid, setResetSaid] = useState('');
  const placeRead = useRef(false);

  const terms = useMemo(() => Object.fromEntries((topic.terms ?? []).map((term) => [term.id, loc(term.term, locale)])), [topic.terms, locale]);
  const specs = useMemo<ParamSpec[]>(() => topic.parameters.map((p) => ({ id: p.id, min: p.min, max: p.max, step: p.step, default: p.default, kind: p.kind })), [topic.parameters]);
  // The viewer of this scene type, if there is one (a new scene type is one line in `features/scene/viewers`).
  const Viewer = viewerFor((topic.scene as { type?: unknown } | undefined)?.type);

  // The place from the address (AD-6, FR-2.7): read once, on the client, after mount, so the static page never
  // depends on it. It is hostile input: `parseUrlState` clamps it and drops what it does not know.
  useEffect(() => {
    const place = parseUrlState(specs, topic.steps.length, window.location.search);
    if (place.step !== null) setPosition({ id: topic.id, index: place.step });
    if (Object.keys(place.params).length > 0) setRestore({ seq: 1, params: { ...place.params } });
    placeRead.current = true;
  }, []);

  // The place goes back into the address, only what the visitor changed, without a history entry, so a language
  // switch (which carries the query and hash) keeps it. Debounced: a slider move is many changes.
  useEffect(() => {
    if (!placeRead.current) return;
    const timer = setTimeout(() => {
      const next = `${window.location.pathname}${mergeUrlState(window.location.search, { step: index, params: changed })}${window.location.hash}`;
      if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, '', next);
    }, 250);
    return () => clearTimeout(timer);
  }, [index, changed]);

  const onChanged = useCallback((next: Record<string, number>) => setChanged(next), []);

  // Reset all (FR-2.5): the sliders, the example, the camera and the toggles go back to the start, and the page to step 1.
  const resetAll = () => {
    setPosition({ id: topic.id, index: 0 });
    setRestore(undefined);
    setChanged({});
    setResetSeq((n) => n + 1);
    setResetSaid(t('resetDone') + (resetSeq % 2 === 0 ? '' : '\u200b')); // the same words again are still said
  };

  const at = useMemo(() => sceneAtStep(topic.steps, index, specs), [topic.steps, index, specs]);
  const step = useMemo<ViewerStep>(() => ({ index, params: at.params, hidden: at.hidden, shown: at.shown, camera: at.camera as Camera | undefined }), [index, at]);
  const current = topic.steps[index];
  const viewerTopic = useMemo(
    () => ({ title: topic.title, scene: topic.scene, parameters: topic.parameters, derived: topic.derived, formulas: topic.formulas }),
    [topic],
  );

  const stepViews = useMemo(() => topic.steps.map((s) => ({ id: s.id, title: loc(s.title, locale), body: loc(s.body, locale) })), [topic.steps, locale]);
  const path: PathPart[] = [
    { slug: topic.path.category, name: names?.category ? loc(names.category, locale) : undefined, href: hrefs?.category ?? `/${locale}/${topic.path.category}` },
    { slug: topic.path.subcategory, name: names?.subcategory ? loc(names.subcategory, locale) : undefined, href: hrefs?.subcategory ?? `/${locale}/${topic.path.category}/${topic.path.subcategory}` },
    { slug: topic.path.chapter, name: names?.chapter ? loc(names.chapter, locale) : undefined, href: hrefs?.chapter ?? `/${locale}/${topic.path.category}/${topic.path.subcategory}/${topic.path.chapter}` },
  ];

  const termEntries = useMemo(() => (topic.terms ?? []).map((term) => ({ id: term.id, term: loc(term.term, locale), definition: loc(term.definition, locale) })), [topic.terms, locale]);
  const resetButton = (
    <div>
      <button type="button" onClick={resetAll} className="min-h-11 rounded-md border-2 border-border-strong bg-surface px-4 font-semibold text-text" data-testid="reset-all">
        {t('reset')}
      </button>
      <div role="status" aria-live="polite" className="sr-only" data-testid="reset-live">
        {resetSaid}
      </div>
    </div>
  );
  const stepBar =
    stepViews.length > 0 ? (
      <>
        <StepBar steps={stepViews} index={index} onIndex={setIndex} terms={terms} />
        {resetButton}
      </>
    ) : (
      resetButton
    );
  const backToPicture = (
    <a href="#scene" className="inline-flex min-h-11 items-center text-link underline lg:hidden" data-testid="back-to-picture">
      {t('backToPicture')}
    </a>
  );

  const layout = (parts: { picture: React.ReactNode; extras: React.ReactNode; controls: React.ReactNode; results: React.ReactNode; formulas: React.ReactNode; live: React.ReactNode }) => (
    // Phone: one column in this order (picture, sliders, cut and parts, step, results, formulas). Laptop: the left two
    // thirds hold the picture and what belongs to it, the right third holds the step, the sliders and the formulas.
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:gap-8" data-testid="layout">
      <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
        <div
          id="scene"
          className="order-1 max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:max-h-[var(--vm-space-scene-ratio-phone)] max-lg:overflow-y-auto max-lg:bg-bg lg:order-none lg:sticky lg:top-4 lg:self-start [@media(max-height:40rem)]:static [@media(max-height:40rem)]:max-h-none [@media(max-width:22.5rem)]:static [@media(max-width:22.5rem)]:max-h-none"
          data-testid="scene-block"
        >
          {parts.picture}
        </div>
      </div>
      <div className="contents lg:col-span-1 lg:flex lg:flex-col lg:gap-6">
        <div className="order-4 lg:order-none lg:hidden">{backToPicture}</div>
        <div className="order-4 flex flex-col gap-6 lg:order-none">
          {stepBar}
        </div>
        <div className="order-2 lg:order-none">{parts.controls}</div>
        {/* Play, the cut, the parts of the net and the fill belong with the controls on the right: the sticky picture on the left would cover them. */}
        <div className="order-3 flex flex-col gap-6 lg:order-none">{parts.extras}</div>
        <div className="order-5 lg:order-none">{parts.results}</div>
        <div className="order-6 lg:order-none">{parts.formulas}</div>
        {parts.live}
      </div>
    </div>
  );

  return (
    <TermProvider terms={termEntries}>
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-4" data-testid="topic-page">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PathLinks parts={path} current={loc(topic.title, locale)} />
          <LanguageSwitcher />
        </div>
        <h1 className="m-0 text-2xl font-bold">{loc(topic.title, locale)}</h1>
        <p className="m-0 text-muted">
          {t(`level.${topic.level}`)} · {t('minutes', { n: topic.estimatedMinutes })}
        </p>
        <p className="m-0">
          <RichText text={loc(topic.goal, locale)} terms={terms} />
        </p>
      </header>

      <TopicLinks kind="needFirst" links={prerequisites ?? []} />

      {Viewer ? (
        <Viewer topic={viewerTopic} step={step} highlight={current?.formulaRefs} restore={restore} resetSeq={resetSeq} onChanged={onChanged}>
          {layout}
        </Viewer>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="m-0 rounded-md border-2 border-hint p-3" data-testid="no-scene">
            {t('noScene')}
          </p>
          {stepBar}
        </div>
      )}

      <WorkedExample example={topic.example} terms={terms} resetSeq={resetSeq} />

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

      <TopicLinks kind="learnNext" links={upNext ?? []} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <ShareButton />
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
    </TermProvider>
  );
}
