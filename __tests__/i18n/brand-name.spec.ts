import fs from "fs"
import path from "path"

import en from "@app/i18n/en"

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

// "Galoy" is still a legitimate internal identifier (screen names, config keys).
// It must never surface in a value a user can read.
const LEGACY_BRAND = /galoy/i

type AnyTranslation = Record<string, unknown>

const collectLegacyBrandValues = (node: unknown, prefix = ""): string[] => {
  if (typeof node === "string")
    return LEGACY_BRAND.test(node) ? [`${prefix}: ${node}`] : []
  if (node === null || typeof node !== "object") return []
  const obj = node as AnyTranslation
  return Object.keys(obj).flatMap((key) =>
    collectLegacyBrandValues(obj[key], prefix ? `${prefix}.${key}` : key),
  )
}

const localeFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()

describe("legacy brand name", () => {
  it("does not appear in any user-facing string in the English source", () => {
    expect(collectLegacyBrandValues(en)).toEqual([])
  })

  localeFiles.forEach((localeFile) => {
    it(`does not appear in any user-facing string in ${localeFile}`, () => {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
      ) as AnyTranslation

      expect(collectLegacyBrandValues(parsed)).toEqual([])
    })
  })
})
