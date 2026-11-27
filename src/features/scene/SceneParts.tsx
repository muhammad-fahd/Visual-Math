'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode, RefObject } from 'react';
import type { Topic } from '../../lib/topic-schema';
import { MathHtml } from './MathHtml';
import { NumberControl } from './NumberFields';
import type { useSceneState } from './useSceneState';

// The parts of a viewer that every scene type has (Story 3.1, extracted from the solid viewer): the sliders
// and typed boxes, the readouts, the live formulas and the polite live region.

type State = ReturnType<typeof useSceneState>;

/** The pieces of a viewer, for a page that places them itself (the topic page). */
export interface ViewerParts {
  /** The picture with its notices; carries the viewer's data attributes. */
  picture: ReactNode;
  /** What belongs beside the picture's controls (Play, the cut, the parts of the net, the fill text, a legend). */
  extras: ReactNode;
  /** The sliders and typed boxes. */
  controls: ReactNode;
  /** The readouts. */
  results: ReactNode;
  /** The live formulas. */
  formulas: ReactNode;
  /** The polite live region. */
  live: ReactNode;
}

export function ParameterControls({ parameters, state, onUserInput }: { parameters: Topic['parameters']; state: State; onUserInput?: () => void }) {
  const { t, locale, fields, values, drafts, errors, firstSlider } = state;
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">{t('measurements')}</h2>
      <div className="flex flex-col gap-4">
        {parameters.map((p, i) => (
          <NumberControl
            key={p.id}
            spec={p}
            locale={locale}
            value={values[p.id]!}
            draft={drafts[p.id] ?? ''}
            error={errors[p.id] === true}
            inputRef={i === 0 ? (firstSlider as RefObject<HTMLInputElement | null>) : undefined}
            onSlide={(v) => {
              onUserInput?.();
              fields.slide(p, v);
            }}
            onDraft={(raw) => {
              onUserInput?.();
              fields.type(p, raw);
            }}
            onCommit={(raw) => fields.commit(p, raw)}
            onSet={(v) => {
              onUserInput?.();
              fields.choose(p, v);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ReadoutList({ readouts }: { readouts: State['readouts'] }) {
  const t = useTranslations('solid');
  if (readouts.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">{t('readouts')}</h2>
      <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2">
        {readouts.map((r) => (
          <div key={r.id} className="flex gap-2">
            <dt className="font-semibold">{r.label}</dt>
            <dd className="m-0" dir="ltr" data-readout={r.id}>
              {r.shown}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function FormulaList({ formulas }: { formulas: State['formulas'] }) {
  const t = useTranslations('solid');
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">{t('formulas')}</h2>
      <div className="flex flex-col gap-4">
        {formulas.map((f) => (
          <figure key={f.id} className={f.used ? 'm-0 rounded-md border-2 border-primary p-2' : 'm-0 p-2'} data-formula={f.id} data-used={f.used ? 'true' : undefined}>
            {f.used ? <p className="m-0 text-sm font-semibold text-primary">{t('usedInStep')}</p> : null}
            <div className="overflow-x-auto text-lg">
              <MathHtml latex={f.latex} inline={false} />
            </div>
            {f.caption ? <figcaption className="text-muted">{f.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </div>
  );
}

export function LiveRegion({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" className="sr-only" data-testid="readout-live">
      {text}
    </div>
  );
}
