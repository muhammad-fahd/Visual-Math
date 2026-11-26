'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { plainText } from '../../lib/text';
import { RichText } from './RichText';

// The steps of a topic (FR-4.2, 4.3): which step, its title and words, Back and Next. A step is advice,
// never a gate: the sliders and the picture work at every step. Focus stays on the button pressed (the
// buttons are `aria-disabled`, not `disabled`, at the ends, so a press at the last step does not drop
// focus), and the new step's title is said once, politely.

export interface StepView {
  id: string;
  title: string;
  body: string;
}

const button = 'min-h-11 min-w-24 rounded-md border-2 px-4 font-semibold';

export function StepBar({ steps, index, onIndex, terms }: { steps: readonly StepView[]; index: number; onIndex: (i: number) => void; terms: Readonly<Record<string, string>> }) {
  const t = useTranslations('topic');
  const step = steps[index]!;
  const atFirst = index <= 0;
  const atLast = index >= steps.length - 1;
  const [said, setSaid] = useState('');
  const shown = useRef(index);

  // Said when the step changes, not on the first render and not when only its text does (a language switch).
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    setSaid(t('stepAnnounce', { n: index + 1, total: steps.length, title: plainText(step.title, terms) }));
  }, [index, step.title, steps.length, t, terms]);

  return (
    <section aria-labelledby="step-title" data-testid="steps" data-step={index + 1}>
      <p className="m-0 text-muted" data-testid="step-of">
        {t('stepOf', { n: index + 1, total: steps.length })}
      </p>
      <h2 id="step-title" className="mb-2 mt-1 text-xl font-semibold">
        <RichText text={step.title} terms={terms} />
      </h2>
      <p className="mb-3 mt-0">
        <RichText text={step.body} terms={terms} />
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-disabled={atFirst}
          className={`${button} ${atFirst ? 'border-border bg-bg text-muted' : 'border-primary bg-surface text-primary'}`}
          onClick={() => {
            if (!atFirst) onIndex(index - 1);
          }}
        >
          {t('back')}
        </button>
        <button
          type="button"
          aria-disabled={atLast}
          className={`${button} ${atLast ? 'border-border bg-bg text-muted' : 'border-primary bg-primary text-on-primary'}`}
          onClick={() => {
            if (!atLast) onIndex(index + 1);
          }}
        >
          {t('next')}
        </button>
        <span className="text-muted" data-testid="step-edge">
          {atFirst ? t('firstStep') : atLast ? t('lastStep') : ''}
        </span>
      </div>
      <p className="mb-0 mt-3 text-muted">{t('exploreFree')}</p>
      <div role="status" aria-live="polite" className="sr-only" data-testid="step-live">
        {said}
      </div>
    </section>
  );
}
