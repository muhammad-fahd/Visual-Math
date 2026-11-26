import { createLocaleSupport } from '../lib/i18n/locale-support';
import { DEFAULT_LOCALE, LOCALES } from './locales';

export const i18n = createLocaleSupport(LOCALES, DEFAULT_LOCALE);
