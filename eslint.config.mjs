import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import noLiteralText from './eslint-rules/no-literal-text.mjs';

// Architecture rules (AD-1, AD-11, AD-12). Add rules here, not in per-file disables.
const HEX = '^#([0-9a-fA-F]{3,4})$|#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})([^0-9a-fA-F]|$)';
const PHYSICAL_CLASS =
  '(^| )-?(m|p)(l|r)-[^ ]|(^| )(left|right)-[^ ]|(^| )text-(left|right)( |$)|(^| )border-(l|r)(-| |$)|(^| )rounded-(l|r|tl|tr|bl|br)(-| |$)';
// Template pieces are split around ${...}, so `ml-${n}` leaves the cooked text `ml-`: match the prefix.
const PHYSICAL_CLASS_PREFIX =
  '(^| )-?(m|p)(l|r)-|(^| )(left|right)-|(^| )text-(left|right)( |$)|(^| )border-(l|r)(-| |$)|(^| )rounded-(l|r|tl|tr|bl|br)(-| |$)';
const PHYSICAL_PROP = '^(margin|padding)(Left|Right)$|^border(Left|Right)';

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', '_bmad/**', '_bmad-output/**', '.claude/**', 'coverage/**', 'playwright-report/**', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      // The default node resolver does not try .ts; without this every import is "unknown".
      'import/resolver': { typescript: { project: './tsconfig.json' }, node: { extensions: ['.ts', '.tsx', '.js', '.mjs'] } },
      'boundaries/elements': [
        { type: 'lib', pattern: 'src/lib' },
        { type: 'scenes', pattern: 'src/scenes' },
        { type: 'features', pattern: 'src/features' },
        { type: 'server', pattern: 'src/server' },
        { type: 'db', pattern: 'src/db' },
        { type: 'i18n', pattern: 'src/i18n' },
        { type: 'app', pattern: 'src/app' },
      ],
    },
    rules: {
      // lib imports nothing from the repo; client layers never import server or db (AD-1).
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { from: { element: { type: 'lib' } }, allow: { to: { element: { type: 'lib' } } } },
            { from: { element: { type: 'i18n' } }, allow: { to: { element: { types: ['i18n', 'lib'] } } } },
            { from: { element: { type: 'scenes' } }, allow: { to: { element: { types: ['scenes', 'lib'] } } } },
            { from: { element: { type: 'features' } }, allow: { to: { element: { types: ['features', 'scenes', 'lib', 'i18n'] } } } },
            { from: { element: { type: 'server' } }, allow: { to: { element: { types: ['server', 'lib', 'db', 'i18n'] } } } },
            { from: { element: { type: 'db' } }, allow: { to: { element: { types: ['db', 'lib'] } } } },
            { from: { element: { type: 'app' } }, allow: { to: { element: { types: ['app', 'features', 'scenes', 'server', 'lib', 'i18n'] } } } },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/styles/generated/**'],
    languageOptions: { globals: { setTimeout: 'readonly', setInterval: 'readonly', setImmediate: 'readonly' } },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${HEX}/]`, message: 'No hex colors in code. Use a token from DESIGN.md (AD-11).' },
        { selector: `TemplateElement[value.cooked=/${HEX}/]`, message: 'No hex colors in code. Use a token from DESIGN.md (AD-11).' },
        { selector: `Literal[value=/${PHYSICAL_CLASS}/]`, message: 'Use logical CSS (ms-, me-, ps-, pe-, start-, end-, text-start, text-end) so Urdu mirrors (AD-12).' },
        { selector: `TemplateElement[value.cooked=/${PHYSICAL_CLASS_PREFIX}/]`, message: 'Use logical CSS (ms-, me-, ps-, pe-, start-, end-, text-start, text-end) so Urdu mirrors (AD-12).' },
        { selector: `Property[key.name=/${PHYSICAL_PROP}/]`, message: 'Use logical CSS properties (marginInlineStart, paddingInlineEnd, ...) (AD-12).' },
        { selector: "ImportExpression[source.type!='Literal']", message: 'No dynamic import of a non-literal path; content is never executed (AD-1).' },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    plugins: { local: { rules: { 'no-literal-text': noLiteralText } } },
    rules: { 'local/no-literal-text': 'error' },
  },
);
