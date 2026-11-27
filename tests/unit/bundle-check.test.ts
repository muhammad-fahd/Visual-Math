import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THREE_BUDGET_BYTES, scanDir, scanText, threeChunks, threeProblems } from '../../scripts/check-bundle.mjs';

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role: string) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'supabase', role })}.${'s'.repeat(30)}`;

describe('bundle scan (AD-1, AD-9)', () => {
  it('a clean bundle passes', () => {
    expect(scanText('a.js', 'function f(){return JSON.parse(x)} const e=window.evaluate(1); obj.eval2()')).toEqual([]);
  });
  it('eval( is found, but not a longer name or a method', () => {
    expect(scanText('a.js', 'x=eval("1")')).toEqual(['a.js:1 contains eval(']);
    expect(scanText('a.js', '(0,eval)("1")')).toEqual(['a.js:1 contains (0, eval)']); // indirect eval
    expect(scanText('a.js', 'retrieval("1"); obj.eval("1"); myeval(1); $eval(1)')).toEqual([]);
  });
  it('window.eval, an alias of eval, and Function( without new are found', () => {
    expect(scanText('a.js', 'window.eval("1")')).not.toEqual([]);
    expect(scanText('a.js', 'globalThis . eval("1")')).not.toEqual([]);
    expect(scanText('a.js', 'const e = eval; e("1")')).toHaveLength(1);
    expect(scanText('a.js', 'var g = Function("return this")()')).toHaveLength(1);
    expect(scanText('a.js', 'obj.Function("x"); isFunction(x); typeofFunction(1)')).toEqual([]);
  });
  it('new Function( is found, with spaces too', () => {
    expect(scanText('a.js', 'a\nb=new Function("return 1")')).toEqual(['a.js:2 contains new Function(']); // one report, not two
    expect(scanText('a.js', 'b = new   Function ("x")')).toHaveLength(1);
  });
  it('the name of the service-role variable, an sb_secret_ key and a service_role JWT are found', () => {
    expect(scanText('a.js', 'process.env.SUPABASE_SERVICE_ROLE_KEY')).toHaveLength(1);
    expect(scanText('a.js', 'k="sb_secret_' + 'A1b2C3d4E5f6G7h8I9j0K'.repeat(1) + '"')).toHaveLength(1);
    expect(scanText('a.js', `k="${jwt('service_role')}"`)).toEqual(['a.js:1 contains a service-role JWT']);
  });
  it('an anon-role JWT is allowed (it is public by design)', () => {
    expect(scanText('a.js', `k="${jwt('anon')}"`)).toEqual([]);
  });
  it('a malformed JWT-looking string does not crash the scan', () => {
    expect(scanText('a.js', 'eyJhbGciOiJIUzI1NiJ9.eyJ!!!.abcdefgh')).toEqual([]);
  });
  it('the exact value of a configured secret is found, short values are ignored', () => {
    const secret = 'sk-live-' + 'x9'.repeat(15);
    expect(scanText('a.js', `a="${secret}"`, [secret])).toEqual(['a.js contains the value of a server secret']);
    expect(scanText('a.js', 'a="abc"', ['abc'])).toEqual([]);
  });

  describe('over a directory and the script', () => {
    const script = resolve('scripts/check-bundle.mjs');
    const dir = (files: Record<string, string>) => {
      const d = mkdtempSync(join(tmpdir(), 'vm-bundle-'));
      for (const [name, text] of Object.entries(files)) {
        mkdirSync(join(d, name, '..'), { recursive: true });
        writeFileSync(join(d, name), text);
      }
      return d;
    };
    it('names the file and line, searching subfolders', () => {
      const d = dir({ 'chunks/ok.js': 'a', 'chunks/deep/bad.js': 'x\ny=new Function("z")' });
      const problems = scanDir(d);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/bad\.js:2 contains new Function\(/);
    });
    it('no directory, or an empty one, is a failure rather than a pass', () => {
      expect(scanDir(join(tmpdir(), 'vm-does-not-exist'))[0]).toMatch(/run the build first/);
      expect(scanDir(dir({}))[0]).toMatch(/no files to scan/);
    });
    it('exit 0 on a clean directory, 1 with the problem on a bad one', () => {
      const ok = spawnSync(process.execPath, [script, dir({ 'a.js': 'var a=1' })], { encoding: 'utf8' });
      expect(ok.status).toBe(0);
      expect(ok.stdout).toMatch(/bundle ok/);
      const bad = spawnSync(process.execPath, [script, dir({ 'a.js': 'eval("1")' })], { encoding: 'utf8' });
      expect(bad.status).toBe(1);
      expect(bad.stderr).toMatch(/a\.js:1 contains eval\(/);
    });
    it('the secret in the environment is searched for', () => {
      const secret = 'service-key-' + 'q7'.repeat(12);
      const r = spawnSync(process.execPath, [script, dir({ 'a.js': `k="${secret}"` })], { encoding: 'utf8', env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: secret } });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/value of a server secret/);
    });
  });
});

describe('the allow list is narrow', () => {
  it('the known core-js fallback passes, any other Function( next to it still fails', () => {
    expect(scanText('a.js', 'x||function(){return this}()||Function("return this")(),a=1')).toEqual([]);
    expect(scanText('a.js', 'x||Function("return this")(),y=Function("return 1")()')).toHaveLength(1);
    expect(scanText('a.js', 'q=Function(userText)()')).toHaveLength(1);
  });
});

describe('the 3D chunk budget (AD-13)', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'vm-three-'));
  it('finds the chunk that carries three.js, and only that one', () => {
    const d = dir();
    writeFileSync(join(d, 'a.js'), 'export const x = 1;');
    writeFileSync(join(d, 'three.js'), 'class WebGLRenderer{} ' + 'x'.repeat(100));
    const report = threeChunks(d);
    expect(report.files).toHaveLength(1);
    expect(report.files[0]).toContain('three.js');
    expect(report.gzipBytes).toBeGreaterThan(0);
    expect(threeProblems(d)).toEqual([]);
  });
  it('fails above the budget, and says by how much it is over', () => {
    const d = dir();
    // Random-looking text does not compress, so the gzipped size is about the raw size.
    let junk = '';
    let n = 1;
    while (junk.length < 4000) junk += (n = (n * 1103515245 + 12345) % 2147483648).toString(36);
    writeFileSync(join(d, 'three.js'), 'WebGLRenderer ' + junk);
    expect(threeProblems(d, 100)).toHaveLength(1);
    expect(threeProblems(d, 100)[0]).toContain('above its budget');
  });
  it('no build output means no three.js and no problem (the scan itself reports a missing build)', () => {
    expect(threeChunks(join(tmpdir(), 'vm-does-not-exist'))).toEqual({ files: [], gzipBytes: 0 });
  });
  it('the budget is the 450 KB of the architecture', () => {
    expect(THREE_BUDGET_BYTES).toBe(450 * 1024);
  });
});
