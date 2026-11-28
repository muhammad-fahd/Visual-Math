'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LineSegments } from 'three';
import { FIT, HALF, basis } from '../../lib/solid';
import type { ViewLike } from '../../lib/solid';
import type { Dash, Patch, Seg, SpaceModel, SpaceToken } from '../../lib/space';

// Tier A (AD-13) for `space3d`: the lines and patches of the drawing model drawn by three.js. A lazy chunk (the viewer
// imports it with `next/dynamic`, ssr off), never exported from this folder's barrel, so a page without a 3D picture
// never downloads it. Labels are the SVG overlay, drawn with the same projection, so the two can never disagree. The
// camera and view come from the frame; nothing here listens to input. A vector (a solid line of weight 2) is drawn as a thin
// five-sided prism, because a WebGL line is one pixel wide; thin and dashed lines are lines. The vectors are told apart by
// color, dash and label, as in the flat picture.

export interface Space3DProps {
  model: SpaceModel;
  view: ViewLike;
  /** Called once with the canvas, after the first frame, so the viewer can watch for a lost context. */
  onReady: (canvas: HTMLCanvasElement) => void;
}

const RAD = Math.PI / 180;

const VARIABLE: Record<SpaceToken, string> = {
  curve1: '--vm-color-curve-1',
  curve2: '--vm-color-curve-2',
  section: '--vm-color-section',
  accent: '--vm-color-accent',
  axis: '--vm-color-axis',
  grid: '--vm-color-grid',
  edge: '--vm-color-edge',
};

function useTokens(): Record<SpaceToken, string> {
  const read = () => {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(Object.entries(VARIABLE).map(([token, name]) => [token, css.getPropertyValue(name).trim() || 'gray'])) as Record<SpaceToken, string>;
  };
  const [tokens, setTokens] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTokens(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-choice', 'class'] });
    return () => observer.disconnect();
  }, []);
  return tokens;
}

/** The orthographic camera shows the same 120-unit square as the SVG: one world unit is one SVG unit. */
function Fit() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    camera.zoom = Math.max(1, Math.min(size.width, size.height)) / (HALF * 2);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function linesOf(segments: readonly Seg[]): BufferGeometry {
  const positions: number[] = [];
  for (const s of segments) positions.push(s.a[0], s.a[1], s.a[2], s.b[0], s.b[1], s.b[2]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Each segment as a thin prism of this radius (in the group's own units), so a vector has some weight on screen. */
function prismsOf(segments: readonly Seg[], radius: number): BufferGeometry {
  const positions: number[] = [];
  const SIDES = 5;
  for (const s of segments) {
    const d: [number, number, number] = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-9) continue;
    const { u, v } = basis([d[0] / len, d[1] / len, d[2] / len]);
    const ring = Array.from({ length: SIDES }, (_, k) => {
      const angle = (2 * Math.PI * k) / SIDES;
      const o: [number, number, number] = [(u[0] * Math.cos(angle) + v[0] * Math.sin(angle)) * radius, (u[1] * Math.cos(angle) + v[1] * Math.sin(angle)) * radius, (u[2] * Math.cos(angle) + v[2] * Math.sin(angle)) * radius];
      return o;
    });
    for (let k = 0; k < SIDES; k++) {
      const o0 = ring[k]!;
      const o1 = ring[(k + 1) % SIDES]!;
      const a0 = [s.a[0] + o0[0], s.a[1] + o0[1], s.a[2] + o0[2]];
      const b0 = [s.b[0] + o0[0], s.b[1] + o0[1], s.b[2] + o0[2]];
      const a1 = [s.a[0] + o1[0], s.a[1] + o1[1], s.a[2] + o1[2]];
      const b1 = [s.b[0] + o1[0], s.b[1] + o1[1], s.b[2] + o1[2]];
      positions.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function patchGeometry(patch: Patch): BufferGeometry {
  const positions: number[] = [];
  const p = patch.points;
  for (let i = 1; i + 1 < p.length; i++) positions.push(p[0]![0], p[0]![1], p[0]![2], p[i]![0], p[i]![1], p[i]![2], p[i + 1]![0], p[i + 1]![1], p[i + 1]![2]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

// Dash and gap lengths in picture units, as in the SVG; the group is scaled by `unit`, so they are divided by it.
const DASH: Record<Dash, readonly [number, number] | null> = { solid: null, dashed: [3, 2], dotted: [0.6, 1.6] };

function Lines({ segments, token, dash, colors, unit }: { segments: readonly Seg[]; token: SpaceToken; dash: Dash; colors: Record<SpaceToken, string>; unit: number }) {
  const geometry = useMemo(() => linesOf(segments), [segments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const color = useMemo(() => new Color(colors[token]), [colors, token]);
  const pattern = DASH[dash];
  return (
    <lineSegments geometry={geometry} ref={(o: LineSegments | null) => o?.computeLineDistances()}>
      {pattern ? <lineDashedMaterial color={color} dashSize={pattern[0] / unit} gapSize={pattern[1] / unit} /> : <lineBasicMaterial color={color} />}
    </lineSegments>
  );
}

function Prisms({ segments, token, colors, unit }: { segments: readonly Seg[]; token: SpaceToken; colors: Record<SpaceToken, string>; unit: number }) {
  const geometry = useMemo(() => prismsOf(segments, 0.45 / unit), [segments, unit]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const color = useMemo(() => new Color(colors[token]), [colors, token]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} side={DoubleSide} />
    </mesh>
  );
}

function PatchObject({ patch, colors }: { patch: Patch; colors: Record<SpaceToken, string> }) {
  const geometry = useMemo(() => patchGeometry(patch), [patch]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const color = useMemo(() => new Color(colors[patch.token]), [colors, patch.token]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} transparent opacity={patch.opacity} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

function Scene({ model, view }: Pick<Space3DProps, 'model' | 'view'>) {
  const colors = useTokens();
  const unit = (FIT / Math.max(model.fit, 1e-9)) * view.scale;
  // One line object per look, so a scene with many segments is a few draw calls.
  const groups = useMemo(() => {
    const map = new Map<string, { token: SpaceToken; dash: Dash; heavy: boolean; segments: Seg[] }>();
    for (const s of model.segments) {
      const heavy = s.weight === 2 && s.dash === 'solid';
      const key = `${s.token}/${s.dash}/${heavy ? 'heavy' : 'thin'}`;
      const g = map.get(key) ?? { token: s.token, dash: s.dash, heavy, segments: [] };
      g.segments.push(s);
      map.set(key, g);
    }
    return [...map.entries()];
  }, [model.segments]);
  return (
    <group position={[view.panX * HALF * 2, -view.panY * HALF * 2, 0]} scale={unit} rotation={[view.elevation * RAD, view.azimuth * RAD, 0]}>
      {model.patches.map((p, i) => (
        <PatchObject key={`p${i}`} patch={p} colors={colors} />
      ))}
      {groups.map(([key, g]) =>
        g.heavy ? <Prisms key={key} segments={g.segments} token={g.token} colors={colors} unit={unit} /> : <Lines key={key} segments={g.segments} token={g.token} dash={g.dash} colors={colors} unit={unit} />,
      )}
    </group>
  );
}

export default function Space3D({ model, view, onReady }: Space3DProps) {
  return (
    <Canvas
      orthographic
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 1000], near: 1, far: 3000, zoom: 1 }}
      gl={{ antialias: true, powerPreference: 'default', alpha: true }}
      shadows={false}
      className="absolute inset-0"
      onCreated={({ gl }) => onReady(gl.domElement)}
    >
      <Fit />
      <Scene model={model} view={view} />
    </Canvas>
  );
}
