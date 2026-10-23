import i18next, { type TFunction } from "i18next";
import en from "./en.json";
import id from "./id.json";

/**
 * Locale files live next to this module as plain JSON, so a translation platform
 * can read and write them without touching TypeScript. English is the source.
 */
const resources = {
  en: { translation: en },
  id: { translation: id },
} as const;

export type Lang = keyof typeof resources;

export const DEFAULT_LANG: Lang = "en";

/** Tags for Intl, kept beside the resources because they are per language. */
export const INTL_LOCALE: Record<Lang, string> = {
  en: "en-US",
  id: "id-ID",
};

export const HTML_LANG: Record<Lang, string> = {
  en: "en-US",
  id: "id",
};

i18next.init({
  resources,
  lng: DEFAULT_LANG,
  fallbackLng: DEFAULT_LANG,
  supportedLngs: Object.keys(resources),
  initAsync: false,
  interpolation: { escapeValue: false },
});

/** A `t` bound to one language. Server rendering needs this instead of global state. */
export function translator(lang: Lang): TFunction {
  return i18next.getFixedT(lang);
}

export function isLang(value: string): value is Lang {
  return Object.prototype.hasOwnProperty.call(resources, value);
}

/** Pick a language from Accept-Language. Unknown languages fall back to English. */
export function resolveLang(req: Request): Lang {
  const header = req.headers.get("accept-language") || "";

  const entries = header
    .split(",")
    .map((part, index) => {
      const [rawTag = "", ...params] = part.trim().split(";");
      const qParam = params.map(p => p.trim()).find(p => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { tag: rawTag.toLowerCase(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter(entry => entry.tag !== "");

  entries.sort((a, b) => b.q - a.q || a.index - b.index);

  for (const entry of entries) {
    for (const lang of Object.keys(resources) as Lang[]) {
      if (entry.tag === lang || entry.tag.startsWith(`${lang}-`)) return lang;
    }
  }

  return DEFAULT_LANG;
}
