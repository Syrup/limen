import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { DEFAULT_LANG, LOCALES, resolveLang, translator } from "../src/i18n/index.ts";

const DIR = join(import.meta.dir, "../src/i18n");
const CODES = readdirSync(DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => basename(file, ".json"))
  .sort();

const load = (code: string) => JSON.parse(readFileSync(join(DIR, `${code}.json`), "utf8"));

function flatten(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, `${prefix}${key}.`),
  );
}

const pick = (header?: string) =>
  resolveLang(new Request("http://localhost/", header ? { headers: { "accept-language": header } } : undefined));

test("the registry loads every locale file", () => {
  expect(LOCALES).toEqual(CODES);
  expect(LOCALES).toContain(DEFAULT_LANG);
});

test("every locale has the same keys as English", () => {
  const reference = flatten(load("en")).sort();
  for (const code of CODES) {
    expect({ code, keys: flatten(load(code)).sort() }).toEqual({ code, keys: reference });
  }
});

test("Accept-Language picks a known language and falls back to English", () => {
  expect(pick("id-ID,id;q=0.9,en;q=0.8")).toBe("id");
  expect(pick("en-GB,en;q=0.9")).toBe("en");
  expect(pick("fr-FR,fr;q=0.9")).toBe(DEFAULT_LANG);
  expect(pick()).toBe(DEFAULT_LANG);
  expect(DEFAULT_LANG).toBe("en");
});

test("plurals follow the language", () => {
  expect(translator("en")("admin.uses", { count: 1 })).toBe("1 time");
  expect(translator("en")("admin.uses", { count: 3 })).toBe("3 times");
  expect(translator("id")("admin.uses", { count: 1 })).toBe("1 kali");
  expect(translator("id")("admin.uses", { count: 3 })).toBe("3 kali");
});
