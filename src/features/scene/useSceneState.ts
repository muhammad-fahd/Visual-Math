'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from '../../lib/expr';
import { createProgram, unitSymbol } from '../../lib/params';
import { enterStep } from '../../lib/params/steps';
import { fillFormula, type Bound } from '../../lib/text';
import type { Topic } from '../../lib/topic-schema';
import { createAnnouncer, type Camera } from '../../scenes/frame';
import { useNumberFields } from './useNumberFields';

// What every scene viewer shares (Story 3.1, extracted from the solid viewer): the parameters with their
// typed boxes, the program and scope of expressions, entering a step, restoring from the address, Reset all,
// the readouts and their debounced announcements, and the live formulas. A viewer adds its own picture.
//
// The order of the effects here is a contract: a step is applied first, then values from the address (they
// win, and are the visitor's own), then Reset all. See docs/coding-standard.md.

type Loc = Record<string, string>;

/** What a step asks of the scene (Story 2.6): the parameter values at that step, the parts it hides, a camera. */
export interface ViewerStep {
  index: number;
  params: Record<string, number>;
  hidden: ReadonlySet<string>;
  /** Parts a step has shown (an element that starts invisible). */
  shown?: ReadonlySet<string>;
  camera?: Camera;
}

export interface ReadoutSpec {
  id: string;
  label: Loc;
  expr: string;
  decimals: number;
  unit?: string;
}

export interface SceneTopicBase {
  title: Loc;
  scene: { readouts?: ReadoutSpec[] };
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

export interface SceneStateOptions {
  topic: SceneTopicBase;
  step?: ViewerStep;
  /** Formula ids the current step uses: they are marked. */
  highlight?: readonly string[];
  /** Values from the address: applied once per `seq`, and kept as the visitor's own (a step leaves them alone). */
  restore?: { seq: number; params: Record<string, number> };
  /** A counter: each time it goes up everything returns to its start (the page's Reset all). */
  resetSeq?: number;
  /** The parameters the visitor changed and their values, whenever they change (for the address). */
  onChanged?: (changed: Record<string, number>) => void;
  /** Called when a step, the address or a reset takes over from a running animation. */
  stop?: () => void;
  /** Called on Reset all, after the values: the viewer's own toggles go back to their start. */
  onReset?: () => void;
}

export const loc = (text: Loc | undefined, locale: string): string => text?.[locale] ?? text?.['en'] ?? '';

export function useSceneState({ topic, step, highlight, restore, resetSeq, onChanged, stop, onReset }: SceneStateOptions) {
  const t = useTranslations('solid');
  const locale = useLocale();
  const { scene, parameters } = topic;
  const fields = useNumberFields(parameters, step?.params);
  const { values } = fields;
  const firstSlider = useRef<HTMLInputElement | null>(null);

  const program = useMemo(() => createProgram(parameters.map((p) => p.id), topic.derived), [parameters, topic.derived]);
  const scope = useMemo(() => program.scope(values), [program, values]);

  // Entering a step: the parameters the visitor has not moved follow it; the ones they moved keep their value.
  const firstStep = useRef(true);
  const stepIndex = step?.index;
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    if (!step) return;
    stop?.();
    fields.apply(enterStep(values, step.params, fields.touched.current));
  }, [stepIndex]);

  // The address named values: they are applied and kept as the visitor's own. After the step effect above, so they win.
  const lastRestore = useRef(0);
  useEffect(() => {
    if (!restore || restore.seq === lastRestore.current) return;
    lastRestore.current = restore.seq;
    stop?.();
    fields.restore(restore.params);
  }, [restore]);

  // Reset all: the values go back to the start (the step's, if there is one); the viewer resets what it owns.
  const lastReset = useRef(resetSeq ?? 0);
  useEffect(() => {
    if ((resetSeq ?? 0) === lastReset.current) return;
    lastReset.current = resetSeq ?? 0;
    stop?.();
    fields.reset(step?.params);
    onReset?.();
  }, [resetSeq]);

  // What the visitor changed, for the address.
  useEffect(() => {
    if (!onChanged) return;
    const changed: Record<string, number> = {};
    for (const id of fields.touched.current) if (Object.hasOwn(values, id)) changed[id] = values[id]!;
    onChanged(changed);
  }, [values]);

  // ---- numbers shown ----
  const readouts = (scene.readouts ?? []).map((r) => {
    const value = program.evaluate(r.expr, scope);
    const unit = unitSymbol(r.unit);
    return {
      id: r.id,
      label: loc(r.label, locale),
      shown: `${format(value, r.decimals)}${unit}`,
      spoken: Number.isFinite(value) ? `${format(value, r.decimals)}${unit}` : t('undefinedValue'),
    };
  });
  const formulas = topic.formulas.map((f) => {
    const bound: Record<string, Bound> = {};
    for (const [name, b] of Object.entries(f.bind ?? {})) bound[name] = { value: program.evaluate(b.expr, scope), decimals: b.decimals };
    return { id: f.id, latex: fillFormula(f.latex, bound), caption: loc(f.caption, locale), used: highlight?.includes(f.id) === true };
  });

  return { t, locale, fields, values, drafts: fields.drafts, errors: fields.errors, program, scope, firstSlider, readouts, formulas, title: loc(topic.title, locale) };
}

/** The sentences the polite live region says: the readouts, then the viewer's own results. */
export const spokenOf = (readouts: ReturnType<typeof useSceneState>['readouts'], extra: readonly string[] = []): string =>
  [...readouts.map((r) => `${r.label}: ${r.spoken}`), ...extra].filter(Boolean).join('. ');

/** One polite live region, debounced 500 ms (AD-15). The text is not said on the first render. */
export function useAnnouncement(text: string): string {
  const [announcement, setAnnouncement] = useState('');
  const announcer = useRef<ReturnType<typeof createAnnouncer> | null>(null);
  const last = useRef(text);
  useEffect(() => {
    announcer.current = createAnnouncer(setAnnouncement);
    return () => announcer.current?.cancel();
  }, []);
  useEffect(() => {
    if (text === last.current) return;
    last.current = text;
    announcer.current?.say(text);
  }, [text]);
  return announcement;
}
