'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { NOTE_MAX, REASONS, checkNote, cleanNote, noteLength, type Reason } from '../../lib/report';

// "Report a problem" (FR-2.4, UX-DR9): a sheet with a reason and a note of at most 500 characters, sent
// without a login to /api/report. The sheet is a native modal <dialog>, so the browser keeps focus inside,
// closes it on Esc, makes the page behind it inert and gives focus back to the button. A failure never
// clears what the visitor wrote. The thanks is a polite toast outside the sheet.

type Failure = 'required' | 'tooLong' | 'rateLimited' | 'failed' | null;

const button = 'min-h-11 rounded-md border-2 px-4 font-semibold';

export function ReportProblem({ topicId }: { topicId: string }) {
  const t = useTranslations('report');
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<Reason>('wrong-math');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const [wait, setWait] = useState(0);
  const [thanks, setThanks] = useState(0); // counts thanks, so a second one restarts the timer
  const noteBox = useRef<HTMLTextAreaElement>(null);
  const pressed = useRef<EventTarget | null>(null);
  const ids = { note: useId(), hint: useId(), error: useId() };

  useEffect(() => {
    if (!thanks) return;
    const timer = setTimeout(() => setThanks(0), 6000);
    return () => clearTimeout(timer);
  }, [thanks]);

  const open = () => {
    setFailure(null);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const send = async () => {
    if (sending) return;
    const problem = checkNote(reason, cleanNote(note));
    if (problem) {
      setFailure(problem === 'required' ? 'required' : 'tooLong');
      noteBox.current?.focus(); // the field to fix
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'omit', // no cookie leaves with a report
        body: JSON.stringify({ topicId, reason, note }),
      });
      if (res.status === 204) {
        setNote('');
        setReason('wrong-math');
        close();
        setThanks((n) => n + 1);
      } else if (res.status === 429) {
        const seconds = Number(res.headers.get('retry-after'));
        setWait(Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : 1);
        setFailure('rateLimited');
      } else if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setFailure(body?.error?.code === 'note_required' ? 'required' : body?.error?.code === 'note_too_long' ? 'tooLong' : 'failed');
      } else {
        setFailure('failed');
      }
    } catch {
      setFailure('failed');
    } finally {
      setSending(false);
    }
  };

  const noteRequired = reason === 'other';
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={open} className={`${button} border-border-strong bg-surface text-text`} data-testid="report-open">
        {t('open')}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${ids.note}-title`}
        onMouseDown={(e) => {
          pressed.current = e.target;
        }}
        onCancel={(e) => {
          if (sending) e.preventDefault(); // Esc does not drop a report that is on its way
        }}
        onClick={(e) => {
          // A press on the backdrop closes the sheet: pressed and released on it, not a text selection that ends there.
          if (e.target === dialog.current && pressed.current === dialog.current && !sending) close();
        }}
        className="m-0 mt-auto w-full max-w-none rounded-t-xl border-2 border-border-strong bg-surface p-0 text-text backdrop:bg-scrim sm:m-auto sm:max-w-lg sm:rounded-xl"
        data-testid="report-sheet"
      >
        <form
          method="dialog"
          className="flex flex-col gap-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <h2 id={`${ids.note}-title`} className="m-0 text-xl font-semibold">
            {t('title')}
          </h2>
          <p className="m-0 text-muted">{t('intro')}</p>

          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 p-0 font-semibold">{t('reasonLegend')}</legend>
            {REASONS.map((r) => (
              <label key={r} className="flex min-h-11 items-center gap-3">
                <input type="radio" name={`reason-${ids.note}`} value={r} checked={reason === r} onChange={() => {
                  setReason(r);
                  setFailure(null);
                }} className="size-5 accent-primary" />
                {t(`reasons.${r}`)}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor={ids.note} className="font-semibold">
              {t('noteLabel')} <span className="font-normal text-muted">{noteRequired ? t('required') : t('optional')}</span>
            </label>
            <textarea
              id={ids.note}
              value={note}
              ref={noteBox}
              dir="auto"
              rows={4}
              onChange={(e) => {
                // The limit is in characters, not in UTF-16 units: an emoji counts once.
                setNote(Array.from(e.target.value).slice(0, NOTE_MAX).join(''));
                setFailure((f) => (f === 'required' || f === 'tooLong' ? null : f));
              }}
              aria-describedby={`${ids.hint}${failure ? ` ${ids.error}` : ''}`}
              aria-invalid={failure === 'required' || failure === 'tooLong'}
              className="min-h-24 w-full rounded-md border-2 border-border-strong bg-surface p-3 text-text"
              data-testid="report-note"
            />
            <p id={ids.hint} className="m-0 text-sm text-muted" data-testid="report-count">
              {t('count', { n: noteLength(note), max: NOTE_MAX })}
            </p>
          </div>

          {failure ? (
            <p id={ids.error} role="alert" className="m-0 rounded-md border-2 border-error p-3" data-testid="report-error">
              {failure === 'rateLimited' ? t('errors.rateLimited', { minutes: wait }) : t(`errors.${failure}`)}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" aria-disabled={sending} onClick={() => { if (!sending) close(); }} className={`${button} border-primary bg-surface text-primary`}>
              {t('cancel')}
            </button>
            <button type="submit" aria-disabled={sending} className={`${button} border-primary bg-primary text-on-primary`} data-testid="report-send">
              {sending ? t('sending') : t('send')}
            </button>
          </div>
        </form>
      </dialog>

      <div role="status" aria-live="polite" className={thanks > 0 ? 'fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-md border-2 border-primary bg-surface p-3 text-center font-semibold text-text shadow-lg' : 'sr-only'} data-testid="report-toast">
        {thanks > 0 ? t('thanks') : ''}
      </div>
    </>
  );
}
