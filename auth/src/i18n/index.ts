import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import i18next, { type TFunction } from "i18next";
import en from "./en.json";

/**
 * Locale files live next to this module as plain JSON, so a translation platform
 * can add a language without touching TypeScript. English is the source file and
 * also the type reference for every key.
 */
const DIR = import.meta.dir;

const resources: Record<string, { translation: Record<string, unknown> }> = {};

for (const file of readdirSync(DIR)) {
  if (!file.endsWith(".json")) continue;
  const code = basename(file, ".json");
  try {
    resources[code] = { translation: JSON.parse(readFileSync(join(DIR, file), "utf8")) };
  } catch (error) {
    console.error(`[limen] skipped locale ${code}: ${error}`);
  }
}

export type Lang = string;

export const LOCALES = Object.keys(resources).sort();
export const DEFAULT_LANG = "en";

i18next.init({
  resources,
  lng: DEFAULT_LANG,
  fallbackLng: DEFAULT_LANG,
  supportedLngs: LOCALES,
  initAsync: false,
  interpolation: { escapeValue: false },
});

/** A `t` bound to one language. Server rendering needs this instead of global state. */
export function translator(lang: Lang): TFunction {
  return i18next.getFixedT(lang);
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
    for (const lang of LOCALES) {
      if (entry.tag === lang || entry.tag.startsWith(`${lang}-`)) return lang;
    }
  }

  return DEFAULT_LANG;
}
