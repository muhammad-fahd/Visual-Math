import { describe, expect, it, vi } from 'vitest';
import { FUNCTION_NAMES, compile, evaluateDetailed, parse, type Scope } from '../../src/lib/expr';

/** Parse and run; fails the test when the source does not parse. */
function ev(src: string, scope: Scope = {}): number {
  const p = parse(src, { scope: Object.keys(scope) });
  if (!p.ok) throw new Error(`did not parse: ${src}: ${p.error.message}`);
  return compile(p.value)(scope);
}
const close = (src: string, expected: number, digits = 10, scope: Scope = {}) => expect(ev(src, scope), src).toBeCloseTo(expected, digits);

describe('known values (NFR-6.2)', () => {
  it.each([
    ['sin(rad(30))', 0.5],
    ['cos(rad(60))', 0.5],
    ['tan(rad(45))', 1],
    ['sin(pi/2)', 1],
    ['atan2(1,1)', Math.PI / 4],
    ['asin(1)', Math.PI / 2],
    ['acos(0)', Math.PI / 2],
    ['atan(1)', Math.PI / 4],
    ['sec(0)', 1],
    ['csc(pi/2)', 1],
    ['cot(pi/4)', 1],
    ['sinh(0)', 0],
    ['cosh(0)', 1],
    ['tanh(0)', 0],
    ['deg(pi)', 180],
    ['rad(180)', Math.PI],
    ['sqrt(16)', 4],
    ['cbrt(27)', 3],
    ['cbrt(-8)', -2],
    ['pow(2,10)', 1024],
    ['exp(0)', 1],
    ['ln(e)', 1],
    ['log10(1000)', 3],
    ['log2(8)', 3],
    ['log(81,3)', 4],
    ['hypot(3,4)', 5],
    ['abs(-3)', 3],
    ['sign(-2)', -1],
    ['sign(0)', 0],
    ['floor(-1.5)', -2],
    ['ceil(-1.5)', -1],
    ['trunc(-1.9)', -1],
    ['round(2.5)', 3],
    ['round(-2.5)', -3],
    ['round(2.4)', 2],
    ['round(0.49999999999999994)', 0],
    ['min(3,1,2)', 1],
    ['max(3,1,2)', 3],
    ['min(1,2,3,4,5,6,7,8)', 1],
    ['clamp(5,0,3)', 3],
    ['clamp(-5,0,3)', 0],
    ['clamp(2,0,3)', 2],
    ['mod(7,3)', 1],
    ['mod(-1,3)', 2],
    ['mod(1,-3)', -2],
    ['mod(5.5,2)', 1.5],
    ['if(1,2,3)', 2],
    ['if(0,2,3)', 3],
    ['if(2<1,10,20)', 20],
  ])('%s = %f', (src, expected) => close(src, expected));

  it('discrete functions', () => {
    for (const [src, v] of [
      ['fact(0)', 1],
      ['fact(1)', 1],
      ['fact(5)', 120],
      ['fact(10)', 3628800],
      ['nCr(5,2)', 10],
      ['nCr(5,0)', 1],
      ['nCr(5,5)', 1],
      ['nCr(10,3)', 120],
      ['nCr(52,5)', 2598960],
      ['nPr(5,2)', 20],
      ['nPr(5,0)', 1],
      ['nPr(6,6)', 720],
      ['gcd(12,18)', 6],
      ['gcd(-12,18)', 6],
      ['gcd(7,13)', 1],
      ['gcd(0,5)', 5],
      ['gcd(0,0)', 0],
      ['lcm(4,6)', 12],
      ['lcm(0,5)', 0],
      ['lcm(7,13)', 91],
    ] as const) {
      expect(ev(src), src).toBe(v);
    }
    expect(ev('nCr(1000,500)')).toBeGreaterThan(2.7e299); // the largest the 1e300 cap still allows
    expect(Number.isFinite(ev('fact(166)'))).toBe(true);
    expect(ev('fact(167)')).toBeNaN(); // 167! is above 1e300: the magnitude cap bites before the input cap of 170
  });

  it('statistics', () => {
    close('normcdf(0,0,1)', 0.5);
    expect(ev('normcdf(0,0,1)')).toBe(0.5); // exact
    expect(ev('normcdf(5,5,2)')).toBe(0.5);
    close('normcdf(1.96,0,1)', 0.975, 5);
    close('normcdf(-1.96,0,1)', 0.025, 5);
    close('normcdf(1,0,1)', 0.8413447, 6);
    close('normcdf(110,100,10)', 0.8413447, 6);
    close('normpdf(0,0,1)', 0.3989422804, 9);
    close('normpdf(1,0,1)', 0.2419707245, 9);
    expect(ev('normpdf(0,0,0)')).toBeNaN();
    expect(ev('normcdf(0,0,-1)')).toBeNaN();
    close('binompmf(10,5,0.5)', 252 / 1024, 12);
    close('binompmf(5,0,0.2)', 0.32768, 12);
    close('binompmf(5,5,1)', 1);
    close('binompmf(5,0,0)', 1);
    close('binompmf(5,1,0)', 0);
    close('binompmf(1000,500,0.5)', 0.0252250181783608, 12);
    expect(ev('binompmf(5,6,0.5)')).toBeNaN();
    expect(ev('binompmf(5,2,1.5)')).toBeNaN();
  });

  it('constants', () => {
    close('pi', Math.PI);
    close('e', Math.E);
    close('tau', 2 * Math.PI);
  });
});

describe('every whitelisted function parses and evaluates at its arity', () => {
  const samples: Record<string, string> = {
    sin: 'sin(1)', cos: 'cos(1)', tan: 'tan(1)', sec: 'sec(1)', csc: 'csc(1)', cot: 'cot(1)', asin: 'asin(0.5)', acos: 'acos(0.5)', atan: 'atan(1)',
    atan2: 'atan2(1,2)', sinh: 'sinh(1)', cosh: 'cosh(1)', tanh: 'tanh(1)', rad: 'rad(90)', deg: 'deg(1)', sqrt: 'sqrt(2)', cbrt: 'cbrt(2)',
    pow: 'pow(2,3)', exp: 'exp(1)', ln: 'ln(2)', log10: 'log10(2)', log2: 'log2(2)', log: 'log(8,2)', hypot: 'hypot(1,2)', abs: 'abs(-1)',
    sign: 'sign(-1)', floor: 'floor(1.5)', ceil: 'ceil(1.5)', round: 'round(1.5)', trunc: 'trunc(1.5)', min: 'min(1,2)', max: 'max(1,2)',
    clamp: 'clamp(1,0,2)', mod: 'mod(5,3)', if: 'if(1,2,3)', fact: 'fact(4)', nCr: 'nCr(5,2)', nPr: 'nPr(5,2)', gcd: 'gcd(4,6)', lcm: 'lcm(4,6)',
    normpdf: 'normpdf(0,0,1)', normcdf: 'normcdf(0,0,1)', binompmf: 'binompmf(5,2,0.5)', sum: 'sum(i,1,3,i)', prod: 'prod(i,1,3,i)',
  };
  it('the sample table covers exactly the whitelist of topic-format section 3', () => {
    expect(Object.keys(samples).sort()).toEqual([...FUNCTION_NAMES]);
    expect(FUNCTION_NAMES).toHaveLength(45);
  });
  it.each(Object.entries(samples))('%s', (_name, src) => {
    expect(Number.isFinite(ev(src)), src).toBe(true);
  });
});

describe('operators and precedence', () => {
  it.each([
    ['-2^2', -4],
    ['2^3^2', 512],
    ['2^-1', 0.5],
    ['(-2)^2', 4],
    ['2^2^0', 2],
    ['1+2*3', 7],
    ['(1+2)*3', 9],
    ['10-4-3', 3],
    ['100/10/5', 2],
    ['10/4', 2.5],
    ['7%3', 1],
    ['-7%3', 2],
    ['2*-3', -6],
    ['--3', 3],
    ['+3', 3],
    ['!0', 1],
    ['!5', 0],
    ['!!7', 1],
    ['1<2', 1],
    ['2<=1', 0],
    ['2>1', 1],
    ['2>=2', 1],
    ['1==1', 1],
    ['1!=1', 0],
    ['1&&0', 0],
    ['2&&3', 1],
    ['0||2', 1],
    ['0||0', 0],
    ['1+1==2', 1],
    ['1<2&&2<3', 1],
    ['1>2||2>1', 1],
    ['1||0&&0', 1], // && binds tighter than ||
    ['2*3^2', 18],
    ['-3^2+1', -8],
    ['1e3', 1000],
    ['2.5e-1', 0.25],
    ['1E+2', 100],
    [' 1 +\n2\t', 3],
  ])('%s = %f', (src, expected) => expect(ev(src), src).toBeCloseTo(expected, 12));

  it('true is 1 and false is 0, and logic does not short-circuit: both sides run', () => {
    expect(ev('1<2')).toBe(1);
    const spy = vi.fn();
    const p = parse('0&&x', { scope: ['x'] });
    if (!p.ok) throw new Error('parse');
    const scope = new Proxy({ x: 1 } as Record<string, number>, { getOwnPropertyDescriptor: (t, k) => (spy(k), Reflect.getOwnPropertyDescriptor(t, k)) });
    expect(compile(p.value)(scope)).toBe(0);
    expect(spy).toHaveBeenCalled(); // x was read although the left side is false
  });
});

describe('scope', () => {
  it('reads the values it is given', () => {
    expect(ev('r', { r: 2 })).toBe(2);
    close('(1/3)*pi*r^2*h', 94.24777960769379, 9, { r: 3, h: 10 });
    expect(ev('a+b', { a: 1, b: 2 })).toBe(3);
  });
  it('a name that is missing at run time, or is not a number, is undefined (NaN)', () => {
    const p = parse('r+1', { scope: ['r'] });
    if (!p.ok) throw new Error('parse');
    const f = compile(p.value);
    expect(f({})).toBeNaN();
    expect(f()).toBeNaN();
    expect(f({ r: '2' } as unknown as Scope)).toBeNaN();
    expect(f({ r: NaN })).toBeNaN();
    expect(f({ r: Infinity })).toBeNaN();
    expect(f(null as unknown as Scope)).toBeNaN();
    expect(f(undefined)).toBeNaN();
  });
  it('only own values count: an inherited name is not read', () => {
    const p = parse('toString', { scope: ['toString'] });
    if (!p.ok) throw new Error('parse');
    expect(compile(p.value)({})).toBeNaN();
    expect(compile(p.value)(Object.create({ toString: 5 }))).toBeNaN();
    expect(compile(p.value)({ toString: 5 })).toBe(5);
  });
  it('names the expression reads are listed, sorted, once', () => {
    const p = parse('b+a*b', { scope: ['a', 'b', 'c'] });
    if (!p.ok) throw new Error('parse');
    expect(p.value.names).toEqual(['a', 'b']);
  });
});

describe('loops: sum and prod', () => {
  it.each([
    ['sum(i,1,4,i^2)', 30],
    ['sum(i,1,100,i)', 5050],
    ['prod(i,1,5,i)', 120],
    ['sum(i,1,3,sum(j,1,i,j))', 10],
    ['sum(i,5,1,i)', 0],
    ['prod(i,5,1,i)', 1],
    ['sum(i,-2,2,i)', 0],
    ['sum(i,1,2,sum(i,10,11,i))', 42], // the inner i shadows the outer
    ['sum(i,1,3,i)+sum(i,1,3,i*2)', 18],
    ['prod(k,1,4,1+k/k)', 16],
  ])('%s = %f', (src, expected) => expect(ev(src), src).toBe(expected));

  it('bounds may come from the scope; the loop variable wins over a scope name of the same spelling', () => {
    expect(ev('sum(i,1,n,i)', { n: 100 })).toBe(5050);
    expect(ev('sum(i,1,3,i)', { i: 100 })).toBe(6);
    expect(ev('sum(i,1,3,i)+i', { i: 100 })).toBe(106);
  });
  it('a non-integer or undefined bound is NaN; more than 10000 iterations is NaN', () => {
    expect(ev('sum(i,1.5,3,i)')).toBeNaN();
    expect(ev('sum(i,1,n,i)', { n: 2.5 })).toBeNaN();
    const p = parse('sum(i,1,n,i)', { scope: ['n'] });
    if (!p.ok) throw new Error('parse');
    expect(compile(p.value)({})).toBeNaN(); // n is missing at run time
    expect(ev('sum(i,1,10001,1)')).toBeNaN();
  });
  it('a NaN inside the body makes the whole result NaN', () => {
    expect(ev('sum(i,0,3,1/i)')).toBeNaN();
    expect(ev('prod(i,0,3,1/i)')).toBeNaN();
  });
});

describe('domain errors are NaN, never a throw', () => {
  it.each([
    '1/0', '0/0', '5%0', 'sqrt(-1)', 'ln(0)', 'ln(-1)', 'log10(0)', 'log2(-1)', 'log(8,1)', 'log(8,0)', 'log(-8,2)', 'tan(pi/2)', 'sec(pi/2)',
    'csc(0)', 'cot(0)', 'asin(2)', 'acos(-2)', 'mod(1,0)', 'clamp(1,3,0)', 'fact(-1)', 'fact(1.5)', 'fact(171)', 'nCr(5,6)', 'nCr(5,-1)',
    'nCr(1001,2)', 'nPr(1001,2)', 'nPr(5,6)', 'gcd(1.5,2)', 'lcm(1.5,2)', 'gcd(9007199254740993,2)', 'lcm(4503599627370496,3)',
    'binompmf(1001,1,0.5)', 'pow(10,400)', '9^999', 'exp(1000)', 'cosh(1000)', '1e300*10', 'if(1/0,1,2)', '!(1/0)', '(1/0)<1', '(1/0)&&1',
  ])('%s', (src) => expect(ev(src), src).toBeNaN());
  it('a number literal beyond 1e300 is refused at parse, not turned into Infinity', () => {
    for (const src of ['1e301', '1e999', '9'.repeat(400)]) {
      const p = parse(src);
      expect(p.ok, src).toBe(false);
      if (!p.ok) expect(p.error.code).toBe('E_EXPR_LIMIT');
    }
  });
  it('results never carry Infinity or more than 1e300', () => {
    for (const src of ['10^300', '10^299*9', '-(10^300)']) expect(Number.isFinite(ev(src)), src).toBe(true);
    for (const src of ['10^301', '10^300*10', 'exp(710)']) expect(ev(src), src).toBeNaN();
  });
});

describe('the step budget (20000 per call)', () => {
  const run = (src: string, scope: Scope = {}) => {
    const p = parse(src, { scope: Object.keys(scope) });
    if (!p.ok) throw new Error(p.error.message);
    return evaluateDetailed(p.value, scope);
  };
  it('counts one step per node: 1+2 takes 3', () => {
    expect(run('1+2')).toEqual({ value: 3, steps: 3, budgetExceeded: false });
  });
  it('a loop that would take more than 20000 steps is NaN and the hook is told', () => {
    const p = parse('sum(i,1,10000,i^2)');
    if (!p.ok) throw new Error('parse');
    const hook = vi.fn();
    expect(compile(p.value, { onBudgetExceeded: hook })()).toBeNaN();
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(p.value);
    const detailed = evaluateDetailed(p.value);
    expect(detailed.budgetExceeded).toBe(true);
    expect(detailed.steps).toBeLessThanOrEqual(20001);
  });
  it('nested loops multiply, and are cut off', () => {
    expect(run('sum(i,1,100,sum(j,1,100,i*j))').budgetExceeded).toBe(true);
    expect(run('sum(i,1,10,sum(j,1,10,i*j))')).toMatchObject({ value: 3025, budgetExceeded: false });
  });
  it('a loop just under the budget completes', () => {
    const r = run('sum(i,1,4000,i)');
    expect(r.budgetExceeded).toBe(false);
    expect(r.value).toBe(8002000);
    expect(r.steps).toBeLessThan(20000);
  });
  it('looping builtins charge by their input size', () => {
    expect(run('fact(100)').steps).toBeGreaterThan(100);
    expect(run('nCr(1000,500)').steps).toBeGreaterThan(500);
    expect(run('sum(i,1,50,nCr(1000,500)*0)').budgetExceeded).toBe(true); // 50 x about 500
  });
  it('budget is per call: the next call starts fresh', () => {
    const p = parse('sum(i,1,n,i)', { scope: ['n'] });
    if (!p.ok) throw new Error('parse');
    const f = compile(p.value);
    expect(f({ n: 10000 })).toBeNaN(); // too many steps
    expect(f({ n: 10 })).toBe(55);
    expect(f({ n: 10 })).toBe(55);
  });
  it('a compiled expression is reusable and independent between calls', () => {
    const p = parse('x*2', { scope: ['x'] });
    if (!p.ok) throw new Error('parse');
    const f = compile(p.value);
    expect([f({ x: 1 }), f({ x: 2 }), f({ x: 1 })]).toEqual([2, 4, 2]);
  });
});
