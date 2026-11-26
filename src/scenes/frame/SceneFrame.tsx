'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { STEPS, reduceView, startView, type Camera, type Capabilities, type View, type ViewAction } from './camera';
import { createAnnouncer, type Announcer } from './announce';
import { down, gestureStart, move, up, wheelFactor, type Gesture } from './gesture';
import { dismissHint, hintDismissed } from './hint';
import { keyAction } from './keys';

// The scene frame (AD-15, FR-3.1 to 3.4, 3.15, 3.29, FR-2.8): the one owner of turning, zooming and
// moving a picture, of Reset view, Full screen, the keyboard, the role switch, the first-time hint and
// the description. A renderer gets the current view from the render prop and never listens to input.

export interface SceneFrameProps {
  /** The topic title, already in the visitor's language. */
  title: string;
  /** Shown under the picture, always. */
  caption: string;
  /** The long description for "More about this picture"; the disclosure is absent without it. */
  description?: string;
  /** The topic's start camera; an iso view without one. */
  camera?: Camera;
  capabilities?: Partial<Capabilities>;
  /** View toggles of the scene type (solid, wireframe, ...), shown with the other buttons. */
  extraControls?: ReactNode;
  /** Esc from the toolbar moves on to the first slider, which the page owns. */
  onEscapeFromToolbar?: () => void;
  onViewChange?: (view: View) => void;
  children: (view: View) => ReactNode;
}

const DEFAULT_CAPS: Capabilities = { rotate: true, zoom: true, pan: true };
const MOVE_STEP = 0.1;

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  zoomIn: 'M12 5v14M5 12h14',
  zoomOut: 'M5 12h14',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  exitFull: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  downArrow: 'M6 9l6 6 6-6',
} as const;

const button = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border-2 border-border-strong bg-surface px-3 font-semibold text-text';

export function SceneFrame({ title, caption, description, camera, capabilities, extraControls, onEscapeFromToolbar, onViewChange, children }: SceneFrameProps) {
  const t = useTranslations('scene');
  const ids = { caption: useId(), hint: useId(), pad: useId() };
  const caps = useMemo<Capabilities>(() => ({ ...DEFAULT_CAPS, ...capabilities }), [capabilities]);
  // Keyed by what the camera says, not by the object: a caller that builds `camera` inline every render must not reset the view.
  const cameraKey = JSON.stringify(camera ?? null);
  const start = useMemo(() => startView(camera), [cameraKey]);
  const [view, dispatch] = useReducer((v: View, a: ViewAction) => reduceView(v, a, start, caps), start);

  const frameRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>(gestureStart());
  const announcer = useRef<Announcer | null>(null);
  const flip = useRef(false);

  const [focused, setFocused] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [native, setNative] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [message, setMessage] = useState('');
  const fullscreen = native || maximized;

  // The hint is decided after mount, so a returning visitor never sees it flash in the server HTML.
  useEffect(() => setHintVisible(!hintDismissed()), []);

  useEffect(() => {
    announcer.current = createAnnouncer((m) => {
      flip.current = !flip.current;
      setMessage(m + (flip.current ? '​' : '')); // the same words again are still said
    });
    return () => announcer.current?.cancel();
  }, []);
  const say = useCallback((m: string) => announcer.current?.say(m), []);

  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  // A new topic (a new start camera) starts from its own view, not from where the last one was left.
  const firstStart = useRef(true);
  useEffect(() => {
    if (firstStart.current) firstStart.current = false;
    else dispatch({ type: 'reset' });
  }, [start]);

  // A pointer that never ends (window blur, a release outside the page) must not turn the next touch into a pinch.
  useEffect(() => {
    const clear = () => {
      gesture.current = gestureStart();
    };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);

  // Wheel needs a non-passive listener to stop the page from scrolling while the picture zooms.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || !caps.zoom) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dispatch({ type: 'zoom', factor: wheelFactor(e.deltaY, e.deltaMode) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [caps.zoom]);

  // Native Full screen: follow the browser, which also handles Esc.
  const wasNative = useRef(false);
  useEffect(() => {
    const sync = () => {
      const now = document.fullscreenElement === frameRef.current && frameRef.current !== null;
      // The browser's own Esc ends full screen without going through our button: say so.
      if (wasNative.current && !now) say(t('fullScreenOff'));
      wasNative.current = now;
      setNative(now);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [say, t]);

  // The maximized fallback has no browser Esc: leave it from anywhere on the page.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMaximized(false);
        say(t('fullScreenOff'));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [maximized, say, t]);

  const toggleFullscreen = useCallback(async () => {
    const el = frameRef.current;
    if (maximized) {
      setMaximized(false);
      say(t('fullScreenOff'));
      return;
    }
    if (document.fullscreenElement === el && el) {
      await document.exitFullscreen().catch(() => undefined);
      say(t('fullScreenOff'));
      return;
    }
    try {
      if (!el || typeof el.requestFullscreen !== 'function') throw new Error('unavailable');
      await el.requestFullscreen();
    } catch {
      setMaximized(true); // refused or missing: the frame maximizes itself
    }
    say(t('fullScreenOn'));
  }, [maximized, say, t]);

  const act = useCallback(
    (action: ViewAction) => {
      dispatch(action);
      if (action.type === 'reset') say(t('viewReset'));
    },
    [say, t],
  );

  // ---- pointer ----
  const size = () => {
    const r = surfaceRef.current?.getBoundingClientRect();
    return { width: r?.width ?? 0, height: r?.height ?? 0 };
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 2) return; // the middle button and the extra ones do nothing
    gesture.current = down(gesture.current, e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic or already-released pointer cannot be captured; the gesture still works.
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // A mouse that is no longer pressed has let go somewhere we did not see: forget it instead of turning on hover.
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      gesture.current = up(gesture.current, e.pointerId);
      return;
    }
    const moved = move(gesture.current, e.pointerId, { x: e.clientX, y: e.clientY }, size(), caps);
    gesture.current = moved.gesture;
    for (const a of moved.actions) dispatch(a);
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    gesture.current = up(gesture.current, e.pointerId);
  };

  // ---- keyboard ----
  const focusToolbar = () => toolbarRef.current?.querySelector<HTMLElement>('button')?.focus();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const result = keyAction(e, caps);
    if (!result) return; // Tab and every other key stay the browser's
    e.preventDefault();
    if (result.kind === 'escape') {
      // While maximized the page-wide Esc listener leaves the fallback; otherwise Esc goes on to the toolbar.
      if (!maximized) focusToolbar();
      return;
    }
    act(result.action);
  };
  const onToolbarKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey && !maximized) {
      e.preventDefault();
      onEscapeFromToolbar?.();
    }
  };

  const pan = (dx: number, dy: number) => act({ type: 'pan', dx, dy });

  return (
    <div
      ref={frameRef}
      data-scene-frame=""
      className={fullscreen ? (maximized ? 'fixed inset-0 z-50 flex flex-col gap-3 overflow-auto bg-bg p-4' : 'flex flex-col gap-3 overflow-auto bg-bg p-4') : 'flex flex-col gap-3'}
    >
      <figure className="m-0 flex flex-col gap-3">
      <div className="relative">
        <div
          ref={surfaceRef}
          tabIndex={0}
          role={focused ? 'application' : 'img'}
          aria-label={t('interactivePicture', { title })}
          aria-describedby={`${ids.caption}${focused ? ` ${ids.hint}` : ''}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="relative aspect-[4/3] min-h-64 w-full touch-none select-none overflow-hidden rounded-lg border-2 border-border bg-surface"
        >
          {children(view)}
        </div>
        {hintVisible ? (
          <div className="absolute inset-x-2 top-2 flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-border-strong bg-surface p-2 text-text">
            <p className="m-0">{t('dragHint')}</p>
            <button
              type="button"
              className={button}
              onClick={() => {
                dismissHint();
                setHintVisible(false);
              }}
            >
              {t('gotIt')}
            </button>
          </div>
        ) : null}
      </div>

      {/* Its space is always kept: if it collapsed when the frame loses focus, the toolbar would shift up between mouse-down and mouse-up and swallow the click on a button. */}
      <p id={ids.hint} aria-hidden={!focused} className={focused ? 'm-0 text-muted' : 'invisible m-0 text-muted'}>
        {t('keyboardHint')}
      </p>

      <div ref={toolbarRef} onKeyDown={onToolbarKeyDown} className="flex flex-col gap-3">
      <div role="group" aria-label={t('toolbar')} className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} onClick={() => act({ type: 'reset' })}>
          <Icon d={ICONS.reset} />
          {t('resetView')}
        </button>
        {caps.zoom ? (
          <>
            <button type="button" className={button} onClick={() => act({ type: 'zoom', factor: STEPS.zoom })}>
              <Icon d={ICONS.zoomIn} />
              {t('zoomIn')}
            </button>
            <button type="button" className={button} onClick={() => act({ type: 'zoom', factor: 1 / STEPS.zoom })}>
              <Icon d={ICONS.zoomOut} />
              {t('zoomOut')}
            </button>
          </>
        ) : null}
        {caps.pan ? (
          <button type="button" className={button} aria-expanded={padOpen} aria-controls={ids.pad} onClick={() => setPadOpen((o) => !o)}>
            <Icon d={ICONS.move} />
            {t('movePicture')}
          </button>
        ) : null}
        {extraControls}
        <button type="button" className={button} onClick={() => void toggleFullscreen()}>
          <Icon d={fullscreen ? ICONS.exitFull : ICONS.full} />
          {fullscreen ? t('exitFullScreen') : t('fullScreen')}
        </button>
      </div>

      {caps.pan && padOpen ? (
        <div id={ids.pad} role="group" aria-label={t('movePad')} className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => pan(-MOVE_STEP, 0)}>
            <Icon d={ICONS.left} />
            {t('moveLeft')}
          </button>
          <button type="button" className={button} onClick={() => pan(MOVE_STEP, 0)}>
            <Icon d={ICONS.right} />
            {t('moveRight')}
          </button>
          <button type="button" className={button} onClick={() => pan(0, -MOVE_STEP)}>
            <Icon d={ICONS.up} />
            {t('moveUp')}
          </button>
          <button type="button" className={button} onClick={() => pan(0, MOVE_STEP)}>
            <Icon d={ICONS.downArrow} />
            {t('moveDown')}
          </button>
        </div>
      ) : null}
      </div>

      <figcaption id={ids.caption} className="m-0">
        {caption}
      </figcaption>
      </figure>
      {description ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-link">{t('moreAbout')}</summary>
          <p className="m-0 pb-2">{description}</p>
        </details>
      ) : null}

      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
    </div>
  );
}

/**
 * A view toggle for a scene type's `extraControls` (solid, wireframe, labels ...). Scene code may not
 * attach its own handlers (AD-15), so the frame provides the one button that carries a click.
 */
export function FrameToggle({ pressed, onToggle, children }: { pressed: boolean; onToggle: (next: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" className={button} aria-pressed={pressed} onClick={() => onToggle(!pressed)}>
      {children}
    </button>
  );
}
