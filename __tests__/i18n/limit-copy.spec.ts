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

const collectLeaves = (
  node: unknown,
  prefix = "",
  out: Record<string, unknown> = {},
): Record<string, unknown> => {
  if (node === null || typeof node !== "object") {
    out[prefix] = node
    return out
  }
  const obj = node as AnyTranslation
  for (const key of Object.keys(obj)) {
    collectLeaves(obj[key], prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

/**
 * An advertised daily allowance written as a literal amount — "USD 999 daily
 * transaction limit", "$1,000 per day". The enforced value lives on the backend
 * (globals.accountLimitsByLevel), so any copy that states it in prose is a
 * promise the app cannot keep once ops changes the limit.
 *
 * Deliberately narrow: it matches an amount followed closely by a daily
 * qualifier, so educational copy that merely mentions money ("worth over $100
 * billion") is untouched.
 */
const HARDCODED_DAILY_AMOUNT =
  /(USD|\$)\s?[\d,.]{2,}[^.]{0,40}?(daily|per day|a day|each day)/i

const offenders = (source: Record<string, unknown>): string[] =>
  Object.entries(source)
    .filter(([, value]) => typeof value === "string")
    .filter(([, value]) => HARDCODED_DAILY_AMOUNT.test(value as string))
    .map(([key, value]) => `${key} => ${value as string}`)

describe("limit copy", () => {
  // blink-wip#739 (SSF audit) shipped because the advertised limit was prose.
  // The fix is only durable if a third surface cannot reintroduce it.
  it("states no daily limit as a literal amount in the English source", () => {
    expect(offenders(collectLeaves(en))).toEqual([])
  })

  const localeFiles = fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()

  // A translation-platform sync can revert a locale to the pre-fix English
  // string. Key parity stays green when that happens, and so does placeholder
  // parity if the revert predates the placeholder — the amount is simply back
  // in the prose.
  localeFiles.forEach((localeFile) => {
    it(`states no daily limit as a literal amount in ${localeFile}`, () => {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
      ) as AnyTranslation

      expect(offenders(collectLeaves(parsed))).toEqual([])
    })
  })
})
