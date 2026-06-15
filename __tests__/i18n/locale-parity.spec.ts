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

type AnyTranslation = Record<string, unknown>

const collectLeafPaths = (node: unknown, prefix = ""): string[] => {
  if (node === null || typeof node !== "object") return [prefix]
  const obj = node as AnyTranslation
  return Object.keys(obj)
    .sort()
    .flatMap((key) => collectLeafPaths(obj[key], prefix ? `${prefix}.${key}` : key))
}

const sourceLeafPaths = new Set(collectLeafPaths(en))

const diffSets = (
  source: Set<string>,
  target: Set<string>,
): { missing: string[]; extra: string[] } => {
  const missing: string[] = []
  const extra: string[] = []
  for (const p of source) if (!target.has(p)) missing.push(p)
  for (const p of target) if (!source.has(p)) extra.push(p)
  return { missing, extra }
}

const localeFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()

describe("locale parity", () => {
  localeFiles.forEach((localeFile) => {
    describe(localeFile, () => {
      const filePath = path.join(TRANSLATIONS_DIR, localeFile)
      const raw = fs.readFileSync(filePath, "utf8")
      const parsed = JSON.parse(raw) as AnyTranslation
      const localeLeafPaths = new Set(collectLeafPaths(parsed))

      it("has the same set of leaf keys as the English source", () => {
        expect(diffSets(sourceLeafPaths, localeLeafPaths)).toEqual({
          missing: [],
          extra: [],
        })
      })
    })
  })
})
