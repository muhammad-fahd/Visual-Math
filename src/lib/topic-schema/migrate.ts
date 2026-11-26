import { err, type Outcome } from './types';

/** The schema version this code reads and writes. A higher number in a file is refused, never guessed at. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * One function per version step: `MIGRATIONS[n]` turns a version n document into a version n + 1
 * document. Pure; never mutates its input. Empty while there is only version 1.
 */
export const MIGRATIONS: Readonly<Record<number, (doc: Record<string, unknown>) => Record<string, unknown>>> = {};

/** Upgrades an older document, step by step, to the current version. */
export function migrate(doc: unknown, migrations = MIGRATIONS, target = CURRENT_SCHEMA_VERSION): Outcome<unknown> {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return { ok: true, value: doc, problems: [] };
  let current = doc as Record<string, unknown>;
  const version = current['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: true, value: doc, problems: [] }; // the schema reports it
  if (version > target) {
    return { ok: false, problems: [err('E_SCHEMA_VERSION', '/schemaVersion', `schemaVersion ${version} is not supported; this importer reads ${target}.`)] };
  }
  for (let v = version; v < target; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, problems: [err('E_SCHEMA_VERSION', '/schemaVersion', `schemaVersion ${v} cannot be upgraded; this importer reads ${target}.`)] };
    current = { ...step(current), schemaVersion: v + 1 };
  }
  return { ok: true, value: current, problems: [] };
}
