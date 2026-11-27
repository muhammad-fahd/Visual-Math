import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigrations, findProblems, readMigrations } from '../../scripts/check-migrations.mjs';

// Migration 0005 on a real Postgres with Supabase's roles and default grants (Story 2.7).
let db: PGlite;
beforeAll(async () => {
  db = await applyMigrations(readMigrations());
});

const as = async (role: string, sql: string, params: unknown[] = []) => {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
};
const report = (topic: string, reason: string, note: string) => as('service_role', 'select public.report_problem($1, $2, $3)', [topic, reason, note]);
const rows = async (topic: string) => (await db.query<{ reason: string; note: string; repeats: number; handled: boolean }>('select reason, note, repeats, handled from public.problem_report where topic_id = $1 order by id', [topic])).rows;

describe('report_problem (FR-2.4, AD-26)', () => {
  it('stores one row with the topic, the reason and the note, and nothing about the sender', async () => {
    await report('t-one', 'wrong-math', 'The volume is off');
    expect(await rows('t-one')).toEqual([{ reason: 'wrong-math', note: 'The volume is off', repeats: 1, handled: false }]);
    const columns = (await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'problem_report' order by ordinal_position")).rows.map((c) => c.column_name);
    expect(columns).toEqual(['id', 'topic_id', 'reason', 'note', 'note_key', 'repeats', 'created_at', 'last_seen_at', 'handled', 'handled_at']);
  });
  it('the same report again is one row with a repeat count, whatever its case or spacing', async () => {
    await report('t-two', 'unclear', 'Step 2 is hard to follow');
    await report('t-two', 'unclear', 'Step 2 is hard to follow');
    await report('t-two', 'unclear', '  step 2   IS hard to follow ');
    expect(await rows('t-two')).toEqual([{ reason: 'unclear', note: 'Step 2 is hard to follow', repeats: 3, handled: false }]);
  });
  it('another note, or another reason, is another row', async () => {
    await report('t-three', 'unclear', 'a');
    await report('t-three', 'unclear', 'b');
    await report('t-three', 'urdu', 'a');
    expect((await rows('t-three')).map((r) => [r.reason, r.note, r.repeats])).toEqual([['unclear', 'a', 1], ['unclear', 'b', 1], ['urdu', 'a', 1]]);
  });
  it('the same note for another topic is another row', async () => {
    await report('t-four', 'scene', 'blank');
    await report('t-five', 'scene', 'blank');
    expect(await rows('t-four')).toHaveLength(1);
    expect(await rows('t-five')).toHaveLength(1);
  });
  it('an empty note is a report too, and groups with another empty note', async () => {
    await report('t-six', 'unclear', '');
    await report('t-six', 'unclear', '   ');
    expect(await rows('t-six')).toEqual([{ reason: 'unclear', note: '', repeats: 2, handled: false }]);
  });
  it('a handled report is not grouped into: the same report afterwards is a new open row', async () => {
    await report('t-seven', 'wrong-math', 'x');
    await db.exec("update public.problem_report set handled = true, handled_at = now() where topic_id = 't-seven'");
    await report('t-seven', 'wrong-math', 'x');
    expect((await rows('t-seven')).map((r) => [r.repeats, r.handled])).toEqual([[1, true], [1, false]]);
  });
  it('two sends at the same moment make one row, not two', async () => {
    await Promise.all(Array.from({ length: 8 }, () => report('t-eight', 'scene', 'same at once')));
    expect(await rows('t-eight')).toEqual([{ reason: 'scene', note: 'same at once', repeats: 8, handled: false }]);
  });
  it('Urdu text is kept and grouped', async () => {
    await report('t-nine', 'urdu', 'حجم غلط ہے');
    await report('t-nine', 'urdu', 'حجم   غلط ہے');
    expect(await rows('t-nine')).toEqual([{ reason: 'urdu', note: 'حجم غلط ہے', repeats: 2, handled: false }]);
  });
});

describe('what the table refuses', () => {
  it.each([
    ['a topic id with capitals', ['Bad-Id', 'wrong-math', 'x']],
    ['a topic id that is a path', ['../x', 'wrong-math', 'x']],
    ['a topic id that is too short', ['ab', 'wrong-math', 'x']],
    ['an unknown reason', ['t-ten', 'spam', 'x']],
    ['a note over 500 characters', ['t-ten', 'other', 'a'.repeat(501)]],
  ])('%s', async (_name, args) => {
    await expect(report(args[0]!, args[1]!, args[2]!)).rejects.toThrow(/violates check constraint/);
  });
  it('handled and handled_at must agree', async () => {
    await report('t-eleven', 'scene', 'x');
    await expect(db.exec("update public.problem_report set handled = true where topic_id = 't-eleven'")).rejects.toThrow(/check constraint/);
    await expect(db.exec("update public.problem_report set handled_at = now() where topic_id = 't-eleven'")).rejects.toThrow(/check constraint/);
  });
});

describe('who may touch it (AD-8)', () => {
  it('anon and authenticated can neither read, write nor call the functions', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(as(role, 'select * from public.problem_report')).rejects.toThrow(/permission denied/);
      await expect(as(role, "insert into public.problem_report (topic_id, reason, note_key) values ('abc', 'other', repeat('a', 64))")).rejects.toThrow(/permission denied/);
      await expect(as(role, "select public.report_problem('abc', 'other', 'x')")).rejects.toThrow(/permission denied/);
      await expect(as(role, 'select public.problem_report_purge()')).rejects.toThrow(/permission denied/);
    }
  });
  it('the service role can read the list and call the functions, but not write the table directly', async () => {
    await expect(as('service_role', 'select count(*) from public.problem_report')).resolves.toBeDefined();
    await expect(as('service_role', "insert into public.problem_report (topic_id, reason, note_key) values ('abc', 'other', repeat('a', 64))")).rejects.toThrow(/permission denied/);
    await expect(as('service_role', 'delete from public.problem_report')).rejects.toThrow(/permission denied/);
    await expect(as('service_role', "update public.problem_report set note = 'x'")).rejects.toThrow(/permission denied/);
  });
  it('the schema check finds nothing wrong with the new table or functions', async () => {
    expect(await findProblems(db)).toEqual([]);
  });
});

describe('retention (AD-17)', () => {
  it('purges handled reports a year after they were handled, and nothing else', async () => {
    for (const t of ['t-old', 't-recent', 't-open']) await report(t, 'scene', 'x');
    await db.exec("update public.problem_report set handled = true, handled_at = now() - interval '13 months' where topic_id = 't-old'");
    await db.exec("update public.problem_report set handled = true, handled_at = now() - interval '11 months' where topic_id = 't-recent'");
    const n = (await as('service_role', 'select public.problem_report_purge() as n')).rows[0] as { n: number };
    expect(n.n).toBeGreaterThanOrEqual(1);
    expect(await rows('t-old')).toEqual([]);
    expect(await rows('t-recent')).toHaveLength(1);
    expect(await rows('t-open')).toHaveLength(1);
  });
});
