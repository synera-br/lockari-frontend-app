import 'server-only';
import type { Locale } from './middleware';
import en from './locales/en.json';

// Define a type for the dictionary structure based on the English dictionary.
// This provides type safety and autocompletion.
export type Dictionary = typeof en;

const dictionaries = {
  en: () => import('./locales/en.json').then((module) => module.default),
  es: () => import('./locales/es.json').then((module) => module.default),
  pt: () => import('./locales/pt.json').then((module) => module.default),
};

export const getDictionary = async (locale: Locale): Promise<Dictionary> => {
  if (dictionaries[locale]) {
    return dictionaries[locale]();
  }
  // Fallback to English if locale is not found, though middleware should prevent this.
  return dictionaries.en();
}
