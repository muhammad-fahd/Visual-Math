'use client';

import { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import { unitSymbol } from '../../lib/params';

// One slider with its typed box, a toggle or a choice (FR-3.6, 3.7): a visible label with the unit, the
// slider, a box that takes either digit set and refuses anything but one number in range with a short
// message. Used by the viewer's parameters and by the worked example's inputs.

type Loc = Record<string, string>;

export interface FieldSpec {
  id: string;
  label: Loc;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  kind?: 'number' | 'integer' | 'toggle' | 'choice';
  options?: { value: number; label: Loc }[];
}

const loc = (text: Loc | undefined, locale: string): string => text?.[locale] ?? text?.['en'] ?? '';
const inputClass = 'min-h-11 w-24 rounded-md border-2 border-border-strong bg-surface px-3 text-text';

export function NumberControl({
  spec,
  idPrefix = 'param',
  locale,
  value,
  draft,
  error,
  inputRef,
  onSlide,
  onDraft,
  onCommit,
  onSet,
}: {
  spec: FieldSpec;
  idPrefix?: string;
  locale: string;
  value: number;
  draft: string;
  error: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSlide: (v: number) => void;
  onDraft: (raw: string) => void;
  onCommit: (raw: string) => void;
  onSet: (v: number) => void;
}) {
  const t = useTranslations('solid');
  const label = loc(spec.label, locale);
  const unit = unitSymbol(spec.unit).trim();
  const id = `${idPrefix}-${spec.id}`;
  const errorId = `${id}-error`;

  if (spec.kind === 'toggle') {
    return (
      <label className="flex min-h-11 items-center gap-3 font-semibold">
        <input type="checkbox" className="size-6 accent-primary" checked={value !== 0} onChange={(e) => onSet(e.target.checked ? 1 : 0)} />
        {label}
      </label>
    );
  }
  if (spec.kind === 'choice') {
    return (
      <label className="flex flex-col gap-1 font-semibold">
        {label}
        <select className={`${inputClass} w-auto`} value={value} onChange={(e) => onSet(Number(e.target.value))}>
          {(spec.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {loc(o.label, locale)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
        {unit ? <span className="font-normal text-muted"> ({unit})</span> : null}
      </label>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          id={id}
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => onSlide(Number(e.target.value))}
          className="min-h-11 min-w-0 flex-1 accent-primary"
          dir="ltr"
        />
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          aria-label={t('typeValue', { label })}
          aria-invalid={error}
          aria-describedby={error ? errorId : undefined}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit(e.currentTarget.value);
            }
          }}
          className={inputClass}
          data-typed={spec.id}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="m-0 text-error" data-testid={`error-${spec.id}`}>
          {t('range', { min: String(spec.min), max: String(spec.max) })}
        </p>
      ) : null}
    </div>
  );
}
