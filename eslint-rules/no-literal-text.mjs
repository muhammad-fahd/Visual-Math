// Interface text lives in message files, never in components (FR-6.5, NFR-7.1).
// Flags visible text written directly in JSX (including inside ternaries, `&&`, `+` and templates) and string values
// of text-bearing attributes. A string with no letters (a checkmark, digits, punctuation) is allowed.

const HAS_LETTER = /\p{L}/u;
const TEXT_ATTRIBUTES = new Set([
  'aria-label', 'aria-description', 'aria-roledescription', 'aria-placeholder', 'aria-valuetext', 'title', 'alt', 'placeholder', 'label',
]);
const MESSAGE = 'Interface text must come from the message files (useTranslations / getTranslations), not a literal string.';

/** Every string literal the expression can render directly: both ternary branches, `a && 'x'`, `'a' + b`, template text. */
function literalStrings(node) {
  if (!node) return [];
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' ? [node.value] : [];
    case 'TemplateLiteral':
      return node.quasis.map((q) => q.value.cooked ?? '');
    case 'ConditionalExpression':
      return [...literalStrings(node.consequent), ...literalStrings(node.alternate)];
    case 'LogicalExpression':
      return [...literalStrings(node.left), ...literalStrings(node.right)];
    case 'BinaryExpression':
      return node.operator === '+' ? [...literalStrings(node.left), ...literalStrings(node.right)] : [];
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSNonNullExpression':
      return literalStrings(node.expression);
    default:
      return [];
  }
}

const hasText = (node) => literalStrings(node).some((s) => HAS_LETTER.test(s));

export default {
  meta: { type: 'problem', docs: { description: 'Disallow literal user-facing text in components' }, schema: [] },
  create(context) {
    return {
      JSXText(node) {
        if (HAS_LETTER.test(node.value.replace(/&nbsp;/g, ' '))) context.report({ node, message: MESSAGE });
      },
      JSXExpressionContainer(node) {
        const inElement = node.parent && (node.parent.type === 'JSXElement' || node.parent.type === 'JSXFragment');
        if (inElement && hasText(node.expression)) context.report({ node, message: MESSAGE });
      },
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : '';
        if (!TEXT_ATTRIBUTES.has(name) || !node.value) return;
        const v = node.value;
        const bad = v.type === 'Literal' ? hasText(v) : v.type === 'JSXExpressionContainer' ? hasText(v.expression) : false;
        if (bad) context.report({ node, message: MESSAGE });
      },
    };
  },
};
