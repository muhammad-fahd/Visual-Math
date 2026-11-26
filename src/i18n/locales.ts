// The one list of languages (FR-6.5, NFR-7.4). Add a language here and add its message file in ./messages.
export const LOCALES = ['en', 'ur'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** First-party functional cookie holding the visitor's explicit language choice (decided in Story 1.3, AD-17). */
export const LOCALE_COOKIE = 'vm-locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
