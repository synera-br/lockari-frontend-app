import 'server-only';
import type { Locale } from './middleware';

const dictionaries = {
  en: () => import('./locales/en.json').then((module) => module.default),
  es: () => import('./locales/es.json').then((module) => module.default),
  pt: () => import('./locales/pt.json').then((module) => module.default),
};

export const getDictionary = async (locale: Locale) => {
  if (dictionaries[locale]) {
    return dictionaries[locale]();
  }
  // Fallback to English if locale is not found, though middleware should prevent this.
  return dictionaries.en();
}
