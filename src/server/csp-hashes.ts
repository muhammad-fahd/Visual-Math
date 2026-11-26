import { createHash } from 'node:crypto';
import { PREPAINT_SCRIPT } from '../lib/theme/prepaint';

/** CSP script-src hash source for the pre-paint theme script (used by the CSP in Story 1.6). */
export const PREPAINT_SCRIPT_SHA256 = `'sha256-${createHash('sha256').update(PREPAINT_SCRIPT).digest('base64')}'`;
