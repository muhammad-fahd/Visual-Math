'use client';

import { useState } from 'react';
import { FrameToggle, SceneFrame, type Capabilities, type View } from '../../scenes/frame';

// A stand-in scene for exercising the scene frame in a real browser (Story 2.3). It draws a simple
// square that turns, scales and moves with the view and prints the view numbers. It is reachable only
// when VM_HARNESS=1 (see the page) and is never part of a visitor's site.

export interface HarnessProps {
  mode: '3d' | '2d' | 'zoom';
  describe: boolean;
  topic: { title: string; caption: string; description: string; toggle: string };
}

const CAPS: Record<HarnessProps['mode'], Partial<Capabilities>> = {
  '3d': { rotate: true, zoom: true, pan: true },
  '2d': { rotate: false, zoom: true, pan: true },
  zoom: { rotate: false, zoom: true, pan: false },
};

function Square({ view }: { view: View }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* Printed in the same render as the view, so a test that reads it right after an input sees the result. */}
      <output data-testid="view" className="sr-only">
        {JSON.stringify(view)}
      </output>
      <div
        className="h-24 w-24 border-4 border-primary bg-selected"
        style={{
          transform: `translate(${view.panX * 100}%, ${view.panY * 100}%) scale(${view.scale}) rotateX(${view.elevation}deg) rotateY(${view.azimuth}deg)`,
        }}
      />
    </div>
  );
}

export function FrameHarness({ mode, describe, topic }: HarnessProps) {
  const [escapes, setEscapes] = useState(0);
  const [wire, setWire] = useState(false);
  return (
    <main className="mx-auto max-w-2xl p-4">
      <SceneFrame
        title={topic.title}
        caption={topic.caption}
        description={describe ? topic.description : undefined}
        capabilities={CAPS[mode]}
        extraControls={
          <FrameToggle pressed={wire} onToggle={setWire}>
            {topic.toggle}
          </FrameToggle>
        }
        onEscapeFromToolbar={() => setEscapes((n) => n + 1)}
      >
        {(v) => <Square view={v} />}
      </SceneFrame>
      <output data-testid="escapes" className="block">
        {escapes}
      </output>
    </main>
  );
}
