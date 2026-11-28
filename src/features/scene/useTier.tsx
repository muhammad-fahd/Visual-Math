'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OFFER_AFTER_MS, lightChosen, rememberLight, webglAvailable, type Tier } from '../../scenes/solid3d';

// Which way a 3D picture is drawn on this device and what to say about it (AD-13), shared by the solid viewer and the
// space viewer (Story 4.1, extracted from `SolidViewer`). A is three.js in a lazy chunk, B is the light flat picture the
// visitor asks for (or is offered after eight seconds with no first frame), C is that same picture with the plain
// message for no WebGL or a lost context. The chunk is requested only when A is chosen.

export function useTier(enabled = true) {
  const [tier, setTier] = useState<Tier | null>(null);
  const [reason, setReason] = useState<'none' | 'lost'>('none');
  const [offer, setOffer] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [canUse3d, setCanUse3d] = useState(false);
  const ready = useRef(false);
  const tierRef = useRef<Tier | null>(null);
  tierRef.current = tier;

  useEffect(() => {
    if (!enabled) return; // a flat scene never draws 3D: no context is made for it
    const gl = webglAvailable(); // once: a device has few contexts to spare
    setCanUse3d(gl);
    setTier(lightChosen() ? 'B' : gl ? 'A' : 'C');
  }, [enabled]);

  useEffect(() => {
    if (tier !== 'A') return;
    ready.current = false;
    const timer = setTimeout(() => {
      if (!ready.current) setOffer(true);
    }, OFFER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [tier]);

  // A lost graphics context drops the picture to Tier C with the plain message (AD-13). The listener is attached the
  // moment the canvas exists, so a context lost right after the first frame is not missed.
  const detach = useRef<(() => void) | null>(null);
  const onReady = useCallback((el: HTMLCanvasElement) => {
    detach.current?.();
    const lost = (e: Event) => {
      e.preventDefault();
      if (tierRef.current !== 'A') return;
      setReason('lost');
      setTier('C');
      setCanvas(null);
    };
    el.addEventListener('webglcontextlost', lost);
    detach.current = () => el.removeEventListener('webglcontextlost', lost);
    ready.current = true;
    setOffer(false);
    setCanvas(el);
  }, []);
  useEffect(() => () => detach.current?.(), []);
  useEffect(() => {
    if (tier !== 'A') {
      detach.current?.();
      detach.current = null;
    }
  }, [tier]);

  const onFail = useCallback(() => {
    if (tierRef.current !== 'A') return;
    detach.current?.();
    detach.current = null;
    setReason('lost');
    setTier('C');
    setCanvas(null);
  }, []);

  const chooseLight = (on: boolean) => {
    rememberLight(on);
    setOffer(false);
    setCanvas(null);
    setTier(on ? 'B' : 'A');
  };

  return { tier, reason, offer, canvas, canUse3d, onReady, onFail, chooseLight, dismissOffer: () => setOffer(false) };
}

export type TierState = ReturnType<typeof useTier>;

/** The notices of the tiers: the plain message (C), the light-picture note (B) and the offer after a slow start (A). */
export function TierNotices({ state }: { state: TierState }) {
  const t = useTranslations('solid');
  const { tier, reason, offer, canUse3d, chooseLight, dismissOffer } = state;
  return (
    <>
      {tier === 'C' ? (
        <p role="status" className="m-0 rounded-md border-2 border-hint p-3 text-text" data-testid="tier-message">
          {reason === 'lost' ? t('contextLost') : t('noWebgl')}
        </p>
      ) : null}
      {tier === 'B' ? (
        <p className="m-0 flex flex-wrap items-center gap-3 text-muted" data-testid="tier-light">
          {t('lightOn')}
          {canUse3d ? (
            <button type="button" className="min-h-11 rounded-md border-2 border-border-strong bg-surface px-3 font-semibold text-text" onClick={() => chooseLight(false)}>
              {t('use3d')}
            </button>
          ) : null}
        </p>
      ) : null}
      {offer && tier === 'A' ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border-2 border-hint p-3" data-testid="tier-offer">
          <p className="m-0">{t('lightOffer')}</p>
          <button type="button" className="min-h-11 rounded-md border-2 border-primary bg-primary px-3 font-semibold text-on-primary" onClick={() => chooseLight(true)}>
            {t('useLight')}
          </button>
          <button type="button" className="min-h-11 rounded-md border-2 border-border-strong bg-surface px-3 font-semibold text-text" onClick={dismissOffer}>
            {t('keepWaiting')}
          </button>
        </div>
      ) : null}
    </>
  );
}
