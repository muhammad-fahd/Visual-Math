'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef } from 'react';
import { createProgram, type ParamSpec } from '../../lib/params';
import { decimalsOfStep, fillFormula, fillText, type Bound, type Shown } from '../../lib/text';
import type { Topic } from '../../lib/topic-schema';
import { MathHtml } from '../scene/MathHtml';
import { NumberControl } from '../scene/NumberFields';
import { useNumberFields } from '../scene/useNumberFields';
import { RichText } from './RichText';

// The worked example (FR-4.4): real numbers the visitor can change. Its inputs take typed values by the
// same rules as the sliders; every line and the answer recompute at once. Lines are calculated by
// `lib/expr` in order, each seeing the inputs and the lines before it; a value that cannot be computed
// shows a dash, never an error.

type Example = Topic['example'];
type Loc = Record<string, string>;

const loc = (text: Loc | undefined, locale: string): string => text?.[locale] ?? text?.['en'] ?? '';

export function WorkedExample({ example, terms, resetSeq }: { example: Example; terms: Readonly<Record<string, string>>; resetSeq?: number }) {
  const t = useTranslations('topic');
  const locale = useLocale();
  const specs = useMemo<ParamSpec[]>(() => example.inputs.map((i) => ({ id: i.id, min: i.min, max: i.max, step: i.step, default: i.default })), [example.inputs]);
  const fields = useNumberFields(specs);
  const lastReset = useRef(resetSeq ?? 0);
  useEffect(() => {
    if ((resetSeq ?? 0) === lastReset.current) return;
    lastReset.current = resetSeq ?? 0;
    fields.reset();
  }, [resetSeq]);

  const program = useMemo(
    () => createProgram(example.inputs.map((i) => i.id), example.lines.flatMap((l) => (l.calc ? [{ id: l.calc.name, expr: l.calc.expr }] : []))),
    [example],
  );
  const scope = useMemo(() => program.scope(fields.values), [program, fields.values]);

  const shown: Record<string, Shown> = {};
  for (const i of example.inputs) shown[i.id] = { value: fields.values[i.id] ?? i.default, decimals: decimalsOfStep(i.step) };
  for (const l of example.lines) if (l.calc) shown[l.calc.name] = { value: scope[l.calc.name] ?? NaN, decimals: l.calc.decimals };
  const bound: Record<string, Bound> = shown;

  const words = (text: Loc) => fillText(loc(text, locale), shown);
  const math = (latex: string | undefined) => (latex ? <MathHtml latex={fillFormula(latex, bound)} inline={false} /> : null);

  return (
    <section aria-labelledby="example-title" data-testid="example">
      <h2 id="example-title" className="mb-2 text-xl font-semibold">
        {t('example')}: {loc(example.title, locale)}
      </h2>
      <p className="mt-0">
        <RichText text={words(example.problem)} terms={terms} />
      </p>
      <div className="mb-4 flex flex-col gap-4">
        {example.inputs.map((i) => {
          const spec = specs.find((s) => s.id === i.id)!;
          return (
            <NumberControl
              key={i.id}
              idPrefix="example"
              spec={{ ...i, kind: 'number' }}
              locale={locale}
              value={fields.values[i.id] ?? i.default}
              draft={fields.drafts[i.id] ?? ''}
              error={fields.errors[i.id] === true}
              onSlide={(v) => fields.slide(spec, v)}
              onDraft={(raw) => fields.type(spec, raw)}
              onCommit={(raw) => fields.commit(spec, raw)}
              onSet={(v) => fields.choose(spec, v)}
            />
          );
        })}
      </div>
      <ol className="m-0 flex list-decimal flex-col gap-3 ps-6">
        {example.lines.map((l, n) => (
          <li key={n} data-line={n + 1}>
            <RichText text={words(l.text)} terms={terms} />
            {l.math ? <div className="overflow-x-auto">{math(l.math)}</div> : null}
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-md border-2 border-primary p-3" data-testid="answer">
        <p className="m-0 font-semibold">{t('answer')}</p>
        <p className="mb-0 mt-1">
          <RichText text={words(example.answer.text)} terms={terms} />
        </p>
        {example.answer.math ? <div className="overflow-x-auto">{math(example.answer.math)}</div> : null}
      </div>
    </section>
  );
}
