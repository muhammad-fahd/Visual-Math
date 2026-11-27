import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import { SCENE_DEFINITIONS, createKit, createSceneRegistry, defaultSceneRegistry, sceneKey } from '../../src/lib/topic-schema';
import { SCENE_META } from '../../src/lib/topic-schema/scenes/meta';
import { describeScene, sceneRegistry } from '../../src/scenes/registry';

// The schema half of the registry lives in lib (the upload service may not import scenes); the viewer
// half lives in src/scenes. They must never drift: one entry here for every entry there.

describe('the two halves of the scene registry stay together (AD-2)', () => {
  it('the same type@v keys in lib and in src/scenes', () => {
    expect(sceneRegistry.keys()).toEqual([...defaultSceneRegistry.keys()]);
    expect(sceneRegistry.keys()).toEqual(['algebra-tool@1', 'canvas2d@1', 'number-model@1', 'right-triangle@1', 'solid3d@1', 'unit-circle@1']);
  });
  it('every definition has a viewer entry with the same key and parts, and the other way round', () => {
    for (const d of SCENE_DEFINITIONS) {
      const entry = sceneRegistry.get(d.type, d.v);
      expect(entry, sceneKey(d.type, d.v)).toBeDefined();
      expect(entry!.partIds).toEqual(d.partIds);
    }
    expect(SCENE_META.map((m) => sceneKey(m.type, m.v)).sort()).toEqual(SCENE_DEFINITIONS.map((d) => sceneKey(d.type, d.v)).sort());
  });
  it('the viewer registry reaches no schema: scenes/meta.ts and scenes/registry.ts import nothing that pulls in zod or yaml', () => {
    const meta = readFileSync('src/lib/topic-schema/scenes/meta.ts', 'utf8').replace(/\/\/.*$/gm, '');
    expect(meta).not.toMatch(/import|require/);
    const registry = readFileSync('src/scenes/registry.ts', 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const imports = [...registry.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual(['../lib/topic-schema/scenes/meta']);
  });
  it('an unknown type or version has no entry', () => {
    expect(sceneRegistry.get('space3d', 1)).toBeUndefined();
    expect(sceneRegistry.get('unit-circle', 2)).toBeUndefined();
    expect(sceneRegistry.get('__proto__', 1)).toBeUndefined();
    expect(sceneRegistry.get('constructor', 1)).toBeUndefined();
  });
  it('lib imports nothing from the scenes layer, and scenes only reaches into lib (the boundaries lint checks the same)', () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
    for (const f of files('src/lib/topic-schema').filter((x) => x.endsWith('.ts'))) {
      const text = readFileSync(f, 'utf8');
      // Only imports that leave src/lib count: this folder has its own `scenes/` of scene-type schemas.
      expect(text, f).not.toMatch(/from ['"](\.\.\/)+(scenes|features|server|db|app|i18n)(\/|['"])/);
      expect(text, f).not.toMatch(/from ['"]@\//);
    }
  });
  it('registry keys, type names and versions are well formed', () => {
    for (const d of SCENE_DEFINITIONS) {
      expect(d.type).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(Number.isInteger(d.v) && d.v >= 1).toBe(true);
      expect(d.partIds.length).toBeGreaterThan(0);
      expect(new Set(d.partIds).size).toBe(d.partIds.length);
    }
  });
  it('every definition builds its schema for the configured languages and for a different list', () => {
    for (const locales of [LOCALES, ['en'], ['en', 'ur', 'xx']] as const) {
      const kit = createKit(locales);
      for (const d of SCENE_DEFINITIONS) expect(() => d.schema(kit)).not.toThrow();
    }
  });
  it('definitions are frozen once registered, and the registry copy cannot be changed by the caller', () => {
    const parts = ['a'];
    const registry = createSceneRegistry([{ type: 't', v: 1, partIds: parts, schema: () => createKit(['en']).ident }]);
    parts.push('b');
    expect(registry.get('t', 1)!.partIds).toEqual(['a']);
    expect(Object.isFrozen(registry.get('t', 1))).toBe(true);
    expect(Object.isFrozen(registry.get('t', 1)!.partIds)).toBe(true);
  });
});

describe('describeScene: the text read for "More about this picture"', () => {
  const scene = { caption: { en: 'Caption', ur: 'عنوان' }, description: { en: 'Description', ur: 'تفصیل' } };
  it('prefers the description, in the visitor\'s language', () => {
    expect(describeScene(scene, 'ur')).toBe('تفصیل');
    expect(describeScene(scene, 'en')).toBe('Description');
  });
  it('falls back to the caption, then to English, then to nothing', () => {
    expect(describeScene({ caption: scene.caption }, 'ur')).toBe('عنوان');
    expect(describeScene({ caption: { en: 'C' }, description: { en: 'D' } }, 'ur')).toBe('D');
    expect(describeScene({ caption: { en: 'C' } }, 'ur')).toBe('C');
    expect(describeScene({}, 'ur')).toBe('');
  });
  it('is what the registry entry uses', () => {
    expect(sceneRegistry.get('unit-circle', 1)!.describe(scene, 'ur')).toBe('تفصیل');
  });
});
