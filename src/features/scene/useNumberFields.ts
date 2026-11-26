'use client';

import { useCallback, useRef, useState } from 'react';
import { checkTyped, defaults, snap, type ParamSpec } from '../../lib/params';

// The values behind a set of sliders and typed boxes (FR-3.6, 3.7), shared by the viewer's parameters and
// the worked example's inputs. A value a visitor sets (slider, typed, choice) is remembered as touched, so
// a step that follows leaves it alone; a value set by code (a step, Play) is not.

export function useNumberFields(specs: readonly ParamSpec[], initial?: Readonly<Record<string, number>>) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const out = defaults(specs);
    for (const s of specs) if (initial && Object.hasOwn(initial, s.id) && Number.isFinite(initial[s.id])) out[s.id] = snap(s, initial[s.id]!);
    return out;
  });
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(specs.map((s) => [s.id, String(initial && Object.hasOwn(initial, s.id) && Number.isFinite(initial[s.id]) ? snap(s, initial[s.id]!) : s.default)])),
  );
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const touched = useRef(new Set<string>());
  const current = useRef(values);
  current.current = values;

  /** Set by code. `syncDraft` is false while the visitor is typing: "7." must stay "7." until they finish. */
  const set = useCallback((spec: ParamSpec, value: number, syncDraft = true) => {
    setValues((v) => ({ ...v, [spec.id]: value }));
    if (syncDraft) setDrafts((d) => ({ ...d, [spec.id]: String(value) }));
    setErrors((e) => ({ ...e, [spec.id]: false }));
  }, []);

  /** Several at once (entering a step): each is snapped to its own range and step. */
  const apply = useCallback(
    (next: Readonly<Record<string, number>>) => {
      const given = specs.filter((s) => Object.hasOwn(next, s.id) && Number.isFinite(next[s.id]));
      setValues((v) => {
        const out = { ...v };
        for (const s of given) out[s.id] = snap(s, next[s.id]!);
        return out;
      });
      setDrafts((d) => {
        const out = { ...d };
        for (const s of given) out[s.id] = String(snap(s, next[s.id]!));
        return out;
      });
      setErrors({});
    },
    [specs],
  );

  const slide = useCallback(
    (spec: ParamSpec, raw: number) => {
      const next = snap(spec, raw);
      if (next !== current.current[spec.id]) touched.current.add(spec.id);
      set(spec, next);
    },
    [set],
  );

  const choose = useCallback(
    (spec: ParamSpec, value: number) => {
      if (value !== current.current[spec.id]) touched.current.add(spec.id);
      set(spec, value);
    },
    [set],
  );

  /** Each keystroke: a good value is applied at once, a bad one waits for Enter or blur. */
  const type = useCallback(
    (spec: ParamSpec, raw: string) => {
      setDrafts((d) => ({ ...d, [spec.id]: raw }));
      const r = checkTyped(spec, raw);
      if (r.ok) {
        if (r.value !== current.current[spec.id]) touched.current.add(spec.id);
        set(spec, r.value, false);
      }
    },
    [set],
  );

  /** Enter or blur: a good value is made plain, a bad one is refused with a message and the old value kept. */
  const commit = useCallback(
    (spec: ParamSpec, raw: string) => {
      const r = checkTyped(spec, raw);
      if (r.ok) {
        // Tabbing through a box, or leaving it as it was, is not a change: a step may still move the value.
        if (r.value !== current.current[spec.id]) touched.current.add(spec.id);
        set(spec, r.value, true);
        return;
      }
      setErrors((e) => ({ ...e, [spec.id]: true }));
      setDrafts((d) => ({ ...d, [spec.id]: String(current.current[spec.id]) }));
    },
    [set],
  );

  return { values, drafts, errors, touched, set, apply, slide, choose, type, commit };
}
