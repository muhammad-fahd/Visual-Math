import { describe, expect, it } from 'vitest';
import { LAYER } from '../../src/lib';

describe('smoke', () => {
  it('loads the lib layer', () => {
    expect(LAYER).toBe('lib');
  });
});
