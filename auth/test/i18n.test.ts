import { expect, test } from "bun:test";
import en from "../src/i18n/en.json";
import id from "../src/i18n/id.json";
import { DEFAULT_LANG, resolveLang, translator } from "../src/i18n/index.ts";

function flatten(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, `${prefix}${key}.`),
  );
}

const pick = (header?: string) =>
  resolveLang(new Request("http://localhost/", header ? { headers: { "accept-language": header } } : undefined));

test("every locale has the same keys as English", () => {
  const reference = flatten(en).sort();
  for (const [code, dict] of Object.entries({ en, id })) {
    expect({ code, keys: flatten(dict).sort() }).toEqual({ code, keys: reference });
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
