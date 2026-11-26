import { getRequestConfig } from 'next-intl/server';
import { locale } from 'next/root-params';
import { DEFAULT_LOCALE } from './locales';
import { messagesFor } from './messages';
import { i18n } from './support';

// The locale comes from the `[locale]` root param, so pages stay static (AD-10, spike 4).
export default getRequestConfig(async () => {
  const raw = await locale();
  const current = i18n.isLocale(raw) ? raw : DEFAULT_LOCALE;
  return { locale: current, messages: messagesFor(current) };
});
