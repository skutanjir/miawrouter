export const LOCALES = ["en", "id"];
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "locale";

export const LOCALE_NAMES = {
  en: "English",
  id: "Bahasa Indonesia",
};

export function normalizeLocale(locale) {
  return locale === "id" ? "id" : DEFAULT_LOCALE;
}

export function isSupportedLocale(locale) {
  return LOCALES.includes(locale);
}
