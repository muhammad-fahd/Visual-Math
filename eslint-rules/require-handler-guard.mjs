// Every Route Handler must call requireAdmin() or ratelimit() and use the result (AD-9, coding
// standard). A handler that does neither is open to anyone, as often as they like. Applied to
// route files under src/app. The check is by name, not by import: it proves the call is there and
// that its result is used, not that it is the right function.

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const GUARDS = new Set(['requireAdmin', 'ratelimit']);

/** A bare `await ratelimit(...)` statement ignores the answer, so it guards nothing. */
function resultUsed(call) {
  let node = call;
  if (node.parent?.type === 'AwaitExpression') node = node.parent;
  return node.parent?.type !== 'ExpressionStatement';
}

/** True when the subtree contains a call to a guard whose result is used (also inside a callback). */
function callsGuard(node, seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return false;
  seen.add(node);
  if (Array.isArray(node)) return node.some((n) => callsGuard(n, seen));
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && GUARDS.has(node.callee.name) && resultUsed(node)) return true;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    if (callsGuard(value, seen)) return true;
  }
  return false;
}

const isFunctionLike = (n) => n && (n.type === 'FunctionDeclaration' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression');

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unguarded: 'Route handler {{name}} does not call requireAdmin() or ratelimit() and use the result; every handler needs one (AD-9).',
      unverifiable: 'Route handler {{name}} is defined in a way this rule cannot check (re-export, destructuring or a wrapper); define it here and guard it (AD-9).',
    },
  },
  create(context) {
    const local = new Map(); // top-level name -> function-like node (function declarations and const functions)
    const exported = []; // { name, node, fn | null, how }

    const note = (name, node, fn) => exported.push({ name, node, fn });

    return {
      FunctionDeclaration(node) {
        if (node.id && node.parent?.type === 'Program') local.set(node.id.name, node);
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isFunctionLike(node.init) && node.parent?.parent?.type !== 'FunctionDeclaration') local.set(node.id.name, node.init);
      },
      ExportNamedDeclaration(node) {
        const d = node.declaration;
        if (d?.type === 'FunctionDeclaration' && d.id && METHODS.has(d.id.name)) note(d.id.name, d, d);
        if (d?.type === 'VariableDeclaration') {
          for (const v of d.declarations) {
            if (v.id.type === 'Identifier' && METHODS.has(v.id.name)) {
              // `export const POST = async () => ...` is checked; `= wrap(handler)` is checked as a whole expression.
              note(v.id.name, v, v.init ?? v);
            } else if (v.id.type !== 'Identifier') {
              // `export const { POST } = handlers`
              const names = (v.id.properties ?? []).map((p) => p.value?.name ?? p.key?.name).filter((n) => METHODS.has(n));
              for (const name of names) context.report({ node: v, messageId: 'unverifiable', data: { name } });
            }
          }
        }
        if (!d) {
          for (const spec of node.specifiers) {
            const name = spec.exported.name ?? spec.exported.value;
            if (!METHODS.has(name)) continue;
            if (node.source) context.report({ node: spec, messageId: 'unverifiable', data: { name } }); // export { POST } from './x'
            else note(name, spec, { resolve: spec.local.name });
          }
        }
      },
      ExportAllDeclaration(node) {
        context.report({ node, messageId: 'unverifiable', data: { name: '(re-exported handlers)' } });
      },
      'Program:exit'() {
        for (const { name, node, fn } of exported) {
          const target = fn && 'resolve' in fn ? local.get(fn.resolve) : fn;
          if (!target || !callsGuard(target)) context.report({ node, messageId: 'unguarded', data: { name } });
        }
      },
    };
  },
};
