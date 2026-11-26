'use client';

import { useState, type FormEvent } from 'react';
import { minutesToWait } from '../../lib/auth/lockout';
import { adminText, fill } from '../../i18n/messages/admin';
import { post, type ApiResult } from './api';

type Step = 'credentials' | 'verify' | 'enrol' | 'codes' | 'recover';
type Enrolment = { factorId: string; qrCode: string; secret: string };

const field = 'mb-4 block w-full min-h-11 rounded-md border-2 border-border-strong bg-surface px-3 text-text';
const button = 'min-h-11 rounded-md border-2 border-primary bg-primary px-4 font-semibold text-on-primary';
const linkButton = 'mt-4 block min-h-11 text-link underline';

/** One generic line per failure; a lock is shown as text with the wait (NFR-2.8). */
function failureText(r: Extract<ApiResult<unknown>, { ok: false }>): string {
  if (r.status === 429) return fill(adminText.signIn.locked, { minutes: minutesToWait(r.retryAfterSeconds ?? 60) });
  if (r.status === 503) return adminText.signIn.unavailable;
  if (r.status === 0) return adminText.signIn.network;
  return adminText.signIn.failed;
}

export function SignInForm() {
  const [step, setStep] = useState<Step>('credentials');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [codes, setCodes] = useState<string[]>([]);

  async function startEnrol() {
    setStep('enrol');
    setEnrolment(null);
    const r = await post<Enrolment>('/api/admin/auth/mfa/enroll', {});
    if (r.ok) setEnrolment(r.data);
    else {
      setStep('credentials');
      setMessage(failureText(r));
    }
  }

  /** A 401 "unauthorized" on a later step means the password step expired: start over. */
  function fail(r: Extract<ApiResult<unknown>, { ok: false }>) {
    if (r.code === 'unauthorized') setStep('credentials');
    setMessage(failureText(r));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '');
    setBusy(true);
    setMessage('');
    try {
      if (step === 'credentials') {
        const r = await post<{ next: 'enroll' | 'verify' }>('/api/admin/auth/sign-in', { email: text('email'), password: text('password') });
        if (!r.ok) return setMessage(failureText(r));
        if (r.data.next === 'enroll') await startEnrol();
        else setStep('verify');
      } else if (step === 'verify' || step === 'enrol') {
        const r = await post<{ recoveryCodes: string[] | null }>('/api/admin/auth/mfa/verify', { factorId: step === 'enrol' ? enrolment?.factorId : undefined, code: text('code').trim() });
        if (!r.ok) return fail(r);
        if (r.data.recoveryCodes) {
          setCodes(r.data.recoveryCodes);
          setStep('codes');
        } else window.location.assign('/admin');
      } else if (step === 'recover') {
        const r = await post<{ next: 'enroll' }>('/api/admin/auth/recover', { code: text('code') });
        if (!r.ok) return fail(r);
        await startEnrol();
      }
    } finally {
      setBusy(false);
    }
  }

  if (step === 'codes') {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">{adminText.recovery.heading}</h1>
        <p className="mb-4">{adminText.recovery.body}</p>
        <ul className="mb-4 font-mono" dir="ltr">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button type="button" className={button} onClick={() => window.location.assign('/admin')}>
          {adminText.recovery.saved}
        </button>
      </section>
    );
  }

  const heading =
    step === 'credentials' ? adminText.signIn.heading : step === 'verify' ? adminText.code.heading : step === 'enrol' ? adminText.enrol.heading : adminText.recovery.enterHeading;

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="mb-4 text-2xl font-bold">{heading}</h1>
      {step === 'credentials' ? (
        <>
          <label>
            {adminText.signIn.email}
            <input name="email" type="email" autoComplete="username" required className={field} />
          </label>
          <label>
            {adminText.signIn.password}
            <input name="password" type="password" autoComplete="current-password" required className={field} />
          </label>
        </>
      ) : null}
      {step === 'enrol' ? (
        enrolment ? (
          <>
            <p className="mb-2">{adminText.enrol.step1}</p>
            <img src={enrolment.qrCode} alt={adminText.enrol.qrAlt} width={192} height={192} className="mb-2 bg-surface" />
            <p className="mb-4">
              {adminText.enrol.key}: <code dir="ltr">{enrolment.secret}</code>
            </p>
            <p className="mb-2">{adminText.enrol.step2}</p>
          </>
        ) : (
          <p>{adminText.enrol.preparing}</p>
        )
      ) : null}
      {step === 'verify' ? <p className="mb-2">{adminText.code.hint}</p> : null}
      {step === 'recover' ? <p className="mb-2">{adminText.recovery.enterHint}</p> : null}
      {step === 'verify' || step === 'enrol' ? (
        <label>
          {adminText.code.label}
          <input name="code" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} required className={field} dir="ltr" />
        </label>
      ) : null}
      {step === 'recover' ? (
        <label>
          {adminText.recovery.label}
          <input name="code" autoComplete="off" required className={field} dir="ltr" />
        </label>
      ) : null}
      <p role="alert" className="mb-4 text-error">
        {message}
      </p>
      <button type="submit" disabled={busy || (step === 'enrol' && !enrolment)} className={button}>
        {step === 'credentials' ? adminText.signIn.submit : step === 'recover' ? adminText.recovery.submit : adminText.code.submit}
      </button>
      {step === 'verify' ? (
        <button type="button" className={linkButton} onClick={() => { setMessage(''); setStep('recover'); }}>
          {adminText.code.useRecovery}
        </button>
      ) : null}
      {step === 'recover' ? (
        <button type="button" className={linkButton} onClick={() => { setMessage(''); setStep('verify'); }}>
          {adminText.recovery.back}
        </button>
      ) : null}
    </form>
  );
}
