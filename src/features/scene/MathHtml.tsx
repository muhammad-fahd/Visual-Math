import 'katex/dist/katex.min.css';
import { plainMath, renderMath } from '../../lib/text';

// The one place KaTeX markup enters the page (AD-14). The markup comes only from `renderMath`, which
// uses the one frozen options object (`trust: false`), from LaTeX that `fillFormula` has already
// reduced to plain numbers. Math is always left to right, also inside Urdu text (FR-3.28). If KaTeX
// refuses the formula, the visitor sees its plain text, never an error page.
export function MathHtml({ latex, inline = true }: { latex: string; inline?: boolean }) {
  const html = renderMath(latex, { inline });
  if (html === null) {
    return (
      <span dir="ltr" className="[unicode-bidi:isolate]">
        {plainMath(latex)}
      </span>
    );
  }
  return <span dir="ltr" className="[unicode-bidi:isolate]" dangerouslySetInnerHTML={{ __html: html }} />;
}
