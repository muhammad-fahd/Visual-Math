'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { FIT, HALF } from '../../lib/solid';
import type { Geometry, Mode, ViewLike } from '../../lib/solid';

// Tier A (AD-13): the solid drawn by three.js. It is a lazy chunk (the viewer imports it with
// `next/dynamic`, ssr off), so a page without a 3D picture never downloads it. It draws only the solid
// and its lines; dimension labels and axes are the SVG overlay, which uses the same projection, so the
// two can never disagree. Camera and view come from the frame; nothing here listens to input.

export interface Solid3DProps {
  geometry: Geometry;
  view: ViewLike;
  /** The radius that fills the picture (the largest the solid can get). */
  fit: number;
  mode: Mode;
  /** Called once with the canvas, after the first frame, so the viewer can watch for a lost context. */
  onReady: (canvas: HTMLCanvasElement) => void;
}

const RAD = Math.PI / 180;

/** The theme's scene colors, read from the CSS tokens and re-read when the theme changes. */
function useTokens() {
  const read = () => {
    const css = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    return { fill: get('--vm-color-fill', 'gray'), edge: get('--vm-color-edge', 'black') };
  };
  const [tokens, setTokens] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTokens(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-choice', 'class'] });
    return () => observer.disconnect();
  }, []);
  return tokens;
}

function meshGeometry(g: Geometry): BufferGeometry {
  const positions: number[] = [];
  for (const face of g.faces) {
    const a = g.vertices[face[0]!]!;
    for (let i = 1; i + 1 < face.length; i++) {
      const b = g.vertices[face[i]!]!;
      const c = g.vertices[face[i + 1]!]!;
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // non-indexed: one normal per triangle, so flat shading
  geometry.computeBoundingSphere();
  return geometry;
}

function lineGeometry(g: Geometry): BufferGeometry {
  const positions: number[] = [];
  for (const [a, b] of g.edges) {
    const p = g.vertices[a]!;
    const q = g.vertices[b]!;
    positions.push(p[0], p[1], p[2], q[0], q[1], q[2]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
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

function Scene({ geometry, view, fit, mode }: Omit<Solid3DProps, 'onReady'>) {
  const tokens = useTokens();
  const mesh = useMemo(() => meshGeometry(geometry), [geometry]);
  const lines = useMemo(() => lineGeometry(geometry), [geometry]);
  // Geometry is rebuilt when a measurement changes; the old one goes back at once.
  useEffect(() => () => mesh.dispose(), [mesh]);
  useEffect(() => () => lines.dispose(), [lines]);
  const fill = useMemo(() => new Color(tokens.fill), [tokens.fill]);
  const edge = useMemo(() => new Color(tokens.edge), [tokens.edge]);

  const unit = (FIT / Math.max(fit, 1e-9)) * view.scale;
  return (
    <group position={[view.panX * HALF * 2, -view.panY * HALF * 2, 0]} scale={unit} rotation={[view.elevation * RAD, view.azimuth * RAD, 0]}>
      {mode !== 'wireframe' ? (
        <mesh geometry={mesh}>
          <meshStandardMaterial
            color={fill}
            flatShading
            transparent={mode === 'transparent'}
            opacity={mode === 'transparent' ? 0.3 : 1}
            depthWrite={mode !== 'transparent'}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      ) : null}
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={edge} transparent={mode !== 'solid'} opacity={mode === 'solid' ? 1 : 0.9} />
      </lineSegments>
    </group>
  );
}

export default function Solid3D({ geometry, view, fit, mode, onReady }: Solid3DProps) {
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
      <ambientLight intensity={1.1} />
      <directionalLight position={[300, 600, 800]} intensity={2} />
      <Scene geometry={geometry} view={view} fit={fit} mode={mode} />
    </Canvas>
  );
}
