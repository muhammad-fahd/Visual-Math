import { beforeEach, describe, expect, it, vi } from 'vitest';

// The glue between the route and the report_problem function: the name of the function and of each
// argument are the contract with migration 0005. A renamed argument would fail every real report.
const state = vi.hoisted(() => ({ rpc: vi.fn(), client: true }));

vi.mock('../../src/db/admin', () => ({ adminClient: () => (state.client ? { rpc: state.rpc } : null) }));

import { saveReport } from '../../src/server/reports';

beforeEach(() => {
  state.rpc = vi.fn(async () => ({ data: null, error: null }));
  state.client = true;
});

describe('saveReport against the report_problem function', () => {
  it('calls report_problem with exactly the three arguments the migration names', async () => {
    expect(await saveReport({ topicId: 'geo-cone-volume', reason: 'wrong-math', note: 'The volume is off' })).toBe(true);
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith('report_problem', { p_topic_id: 'geo-cone-volume', p_reason: 'wrong-math', p_note: 'The volume is off' });
  });
  it('the arguments match the SQL: the function takes p_topic_id, p_reason and p_note, in that order', async () => {
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync('supabase/migrations/0005_problem_report.sql', 'utf8');
    expect(sql).toMatch(/create function public\.report_problem\(p_topic_id text, p_reason text, p_note text\)/);
  });
  it('a database error is false (the route says 503), without throwing', async () => {
    state.rpc = vi.fn(async () => ({ data: null, error: { message: 'connection refused at postgres://u:p@h' } }));
    expect(await saveReport({ topicId: 'abc', reason: 'other', note: 'x' })).toBe(false);
  });
  it('no database configured is false, never "stored"', async () => {
    state.client = false;
    expect(await saveReport({ topicId: 'abc', reason: 'other', note: 'x' })).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('an empty note is passed as an empty string, not left out', async () => {
    await saveReport({ topicId: 'abc', reason: 'scene', note: '' });
    expect(state.rpc).toHaveBeenCalledWith('report_problem', { p_topic_id: 'abc', p_reason: 'scene', p_note: '' });
  });
});
