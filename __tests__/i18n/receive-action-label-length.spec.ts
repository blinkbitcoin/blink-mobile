import fs from "fs"
import path from "path"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

/**
 * The on-chain receive screen sets Copy, Share and New side by side in one row,
 * and at 320dp that row has no slack. A label is ellipsized rather than wrapped
 * (see action-button-row-320.spec), so a long translation never breaks the
 * layout — but it does reach users as "Kopíro…". Anything over twice the English
 * length is flagged here so it gets a shorter translation instead.
 */
const MAX_RATIO = 2

const LABEL_KEYS = ["copyInvoice", "shareInvoice", "newAddress"] as const

/**
 * "New" is three letters in English, so twice that rules out most gendered forms of it
 * (fr "Nouvelle"). It gets an absolute cap instead: the longest form a locale needs
 * today. A longer one is worth a second look before it ships.
 */
const MAX_LENGTH_BY_KEY: Partial<Record<(typeof LABEL_KEYS)[number], number>> = {
  newAddress: 8,
}

/**
 * Over-long labels that predate this check. A ratchet: it may shrink, never grow.
 * Delete an entry once its translation is shortened.
 */
const KNOWN_LONG_LABELS = new Set([
  "cs.json:copyInvoice",
  "el.json:copyInvoice",
  "el.json:shareInvoice",
  "pt.json:shareInvoice",
  "qu.json:shareInvoice",
  "sk.json:copyInvoice",
])

loadLocale("en")
const LL = i18nObject("en")

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

/** Counts what a user sees as characters, so combining marks do not inflate it. */
const visibleLength = (value: string): number => Array.from(value.normalize("NFC")).length

const longLabels = (): string[] =>
  fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((file) => {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, file), "utf8"),
      ) as { ReceiveScreen?: Record<string, string> }
      return LABEL_KEYS.filter((key) => {
        const translated = parsed.ReceiveScreen?.[key]
        if (!translated) return false
        const limit =
          MAX_LENGTH_BY_KEY[key] ?? MAX_RATIO * visibleLength(LL.ReceiveScreen[key]())
        return visibleLength(translated) > limit
      }).map((key) => `${file}:${key}`)
    })

describe("receive action labels", () => {
  const found = longLabels()

  it(`flags no new label longer than ${MAX_RATIO}x its English source`, () => {
    expect(found.filter((entry) => !KNOWN_LONG_LABELS.has(entry))).toEqual([])
  })

  it("keeps the known list honest once a label is shortened", () => {
    expect([...KNOWN_LONG_LABELS].filter((entry) => !found.includes(entry))).toEqual([])
  })
})
