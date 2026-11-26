import './globals.css';
import { LOCALES } from '../i18n/locales';
import { messagesFor } from '../i18n/messages';
import { i18n } from '../i18n/support';
import { PREPAINT_SCRIPT } from '../lib/theme/prepaint';

// Shown when no route matches, e.g. an unknown locale like /fr. The visitor's language is not known here, so every
// supported language is shown, each with its own lang and dir. Text comes from the message files; the list comes
// from LOCALES, so a new language appears without changing this file.
export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body>
        <main className="p-4">
          {LOCALES.map((lang) => {
            const m = messagesFor(lang).notFound;
            return (
              <section key={lang} lang={lang} dir={i18n.direction(lang)} className="mb-6">
                <h1 className="text-2xl font-bold">{m.title}</h1>
                <p className="mb-2">{m.body}</p>
                <a href={`/${lang}`} className="text-link underline">
                  {m.home}
                </a>
              </section>
            );
          })}
        </main>
      </body>
    </html>
  );
}
