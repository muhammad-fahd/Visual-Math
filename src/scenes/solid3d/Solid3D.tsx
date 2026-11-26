'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BufferGeometry, Color, DoubleSide, FrontSide, Float32BufferAttribute } from 'three';
import { FIT, HALF } from '../../lib/solid';
import type { Layer, Mode, Token, ViewLike } from '../../lib/solid';

// Tier A (AD-13): the solid drawn by three.js. It is a lazy chunk (the viewer imports it with
// `next/dynamic`, ssr off), so a page without a 3D picture never downloads it. It draws the layers the
// library composes (the solid or its net, the cutting plane and cut face, the liquid) and their lines;
// dimension labels and axes are the SVG overlay, which uses the same projection, so the two can never
// disagree. Camera and view come from the frame; nothing here listens to input.

export interface Solid3DProps {
  layers: readonly Layer[];
  view: ViewLike;
  /** The radius that fills the picture (the largest the solid can get). */
  fit: number;
  mode: Mode;
  /** A section or a liquid needs a see-through solid. */
  glass: boolean;
  /** Called once with the canvas, after the first frame, so the viewer can watch for a lost context. */
  onReady: (canvas: HTMLCanvasElement) => void;
}

const RAD = Math.PI / 180;

const TOKEN_VARIABLE: Record<Token, string> = { fill: '--vm-color-fill', section: '--vm-color-section', curve1: '--vm-color-curve-1' };

/** The theme's scene colors, read from the CSS tokens and re-read when the theme changes. */
function useTokens() {
  const read = () => {
    const css = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    return {
      fill: get(TOKEN_VARIABLE.fill, 'gray'),
      section: get(TOKEN_VARIABLE.section, 'orange'),
      curve1: get(TOKEN_VARIABLE.curve1, 'blue'),
      edge: get('--vm-color-edge', 'black'),
    };
  };
  const [tokens, setTokens] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTokens(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-choice', 'class'] });
    return () => observer.disconnect();
  }, []);
  return tokens;
}

function meshGeometry(layer: Layer): BufferGeometry {
  const positions: number[] = [];
  for (const face of layer.faces) {
    const a = layer.vertices[face[0]!]!;
    for (let i = 1; i + 1 < face.length; i++) {
      const b = layer.vertices[face[i]!]!;
      const c = layer.vertices[face[i + 1]!]!;
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // non-indexed: one normal per triangle, so flat shading
  geometry.computeBoundingSphere();
  return geometry;
}

function lineGeometry(layer: Layer): BufferGeometry {
  const positions: number[] = [];
  for (const [a, b] of layer.edges) {
    const p = layer.vertices[a]!;
    const q = layer.vertices[b]!;
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

function LayerObject({ layer, mode, glass, tokens }: { layer: Layer; mode: Mode; glass: boolean; tokens: ReturnType<typeof useTokens> }) {
  const mesh = useMemo(() => meshGeometry(layer), [layer]);
  const lines = useMemo(() => lineGeometry(layer), [layer]);
  // Geometry is rebuilt when a measurement or a slider changes; the old one goes back at once.
  useEffect(() => () => mesh.dispose(), [mesh]);
  useEffect(() => () => lines.dispose(), [lines]);
  const color = useMemo(() => new Color(tokens[layer.token]), [tokens, layer.token]);
  const edge = useMemo(() => new Color(layer.token === 'fill' ? tokens.edge : tokens[layer.token]), [tokens, layer.token]);

  const own = layer.id === 'solid' || layer.id === 'net';
  const seeThrough = layer.id === 'solid' && (mode === 'transparent' || glass);
  const opacity = seeThrough ? 0.3 : layer.opacity;
  // A wireframe shows lines only; the plane and the cut face are not the solid and stay.
  const showMesh = mode !== 'wireframe' || !(own || layer.id === 'liquid');
  const transparent = opacity < 1;
  return (
    <>
      {showMesh ? (
        <mesh geometry={mesh}>
          <meshStandardMaterial
            color={color}
            flatShading
            transparent={transparent}
            opacity={opacity}
            depthWrite={!transparent}
            side={layer.doubleSided ? DoubleSide : FrontSide}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      ) : null}
      {layer.id === 'plane' && mode === 'wireframe' ? null : (
        <lineSegments geometry={lines}>
          <lineBasicMaterial color={edge} transparent={transparent || mode !== 'solid'} opacity={layer.id === 'cut' || mode === 'solid' ? 1 : 0.9} />
        </lineSegments>
      )}
    </>
  );
}

function Scene({ layers, view, fit, mode, glass }: Omit<Solid3DProps, 'onReady'>) {
  const tokens = useTokens();
  const unit = (FIT / Math.max(fit, 1e-9)) * view.scale;
  return (
    <group position={[view.panX * HALF * 2, -view.panY * HALF * 2, 0]} scale={unit} rotation={[view.elevation * RAD, view.azimuth * RAD, 0]}>
      {layers.map((layer, i) => (
        <LayerObject key={`${layer.id}-${i}`} layer={layer} mode={mode} glass={glass} tokens={tokens} />
      ))}
    </group>
  );
}

export default function Solid3D({ layers, view, fit, mode, glass, onReady }: Solid3DProps) {
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
      <Scene layers={layers} view={view} fit={fit} mode={mode} glass={glass} />
    </Canvas>
  );
}
