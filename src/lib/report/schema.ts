import { z } from 'zod';
import { RAW_NOTE_MAX, REASONS, TOPIC_ID } from './index';

// The body of POST /api/report. Server only: the browser never imports zod (it would ship in the bundle).
export const reportBody = z
  .object({
    topicId: z.string().regex(TOPIC_ID).min(3).max(64),
    reason: z.enum(REASONS),
    note: z.string().max(RAW_NOTE_MAX),
  })
  .strict();

export type ReportBody = z.infer<typeof reportBody>;
