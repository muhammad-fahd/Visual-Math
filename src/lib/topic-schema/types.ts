// Shared types for the topic format as code (topic-format.md, AD-19, AD-27).

export type Severity = 'error' | 'warning';

/** One problem in a topic file, in the vocabulary of topic-format section 5. */
export interface Problem {
  /** E_... for errors, W_... for warnings. */
  code: string;
  severity: Severity;
  /** JSON Pointer (RFC 6901) into the topic object; "" is the whole document. */
  pointer: string;
  message: string;
  /** 1-based line, only where the source is text (MD) and the line is known. */
  line?: number;
}

export type Outcome<T> = { ok: true; value: T; problems: Problem[] } | { ok: false; problems: Problem[] };

export const err = (code: string, pointer: string, message: string, line?: number): Problem => ({
  code,
  severity: 'error',
  pointer,
  message,
  ...(line === undefined ? {} : { line }),
});

export const warn = (code: string, pointer: string, message: string): Problem => ({ code, severity: 'warning', pointer, message });

/** RFC 6901: `~` is `~0` and `/` is `~1`. */
export function toPointer(path: readonly (string | number | symbol)[]): string {
  return path.map((p) => `/${String(p).replaceAll('~', '~0').replaceAll('/', '~1')}`).join('');
}

/** `<file>#<JSON pointer> [CODE] <message>` as FR-9.3 asks. */
export function formatProblem(file: string, p: Problem): string {
  return `${file}#${p.pointer} [${p.code}] ${p.message}`;
}
