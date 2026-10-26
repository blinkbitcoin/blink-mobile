import fs from "fs"
import path from "path"

import en from "@app/i18n/en"

import retiredTierCopy from "./retired-tier-copy.json"

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

const leaf = (node: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (at, part) =>
        at !== null && typeof at === "object" ? (at as AnyTranslation)[part] : undefined,
      node,
    )

const TIER_KEYS = [
  "SendBitcoinScreen.fast",
  "SendBitcoinScreen.medium",
  "SendBitcoinScreen.slow",
]

/**
 * The retired tier copy ledger. `en.current` is the triple every locale line was last
 * revisited for, and has to equal what `en` ships — so changing the English tier words
 * fails here, in this file, until the ledger is updated with them. `en.retired` holds the
 * words `en` itself has dropped for these keys; a locale still carrying one is an
 * untranslated fallback (#3862). `locales` holds each locale's own outgoing strings, one
 * triple per rename; a locale whose current value is still one of its own retired strings
 * is a locale the rename skipped.
 */
const LEDGER = retiredTierCopy as {
  en: { current: string[]; retired: string[] }
  locales: Record<string, string[]>
}

const normalize = (value: string, locale: string): string =>
  value.trim().toLocaleLowerCase(locale)

const localeOf = (localeFile: string): string => localeFile.replace(/\.json$/, "")

const supersededTierCopy = (localeFile: string, parsed: AnyTranslation): string[] => {
  const locale = localeOf(localeFile)
  const retired = [...LEDGER.en.retired, ...(LEDGER.locales[localeFile] ?? [])].map(
    (value) => normalize(value, locale),
  )

  return TIER_KEYS.filter((key) => {
    const value = leaf(parsed, key)
    return typeof value === "string" && retired.includes(normalize(value, locale))
  })
}

/** A ledger line is one or more whole renames: three non-empty strings each. */
const malformedLedgerLines = (): string[] =>
  Object.entries({
    "en.current": LEDGER.en.current,
    "en.retired": LEDGER.en.retired,
    ...LEDGER.locales,
  })
    .filter(
      ([, line]) =>
        line.length === 0 ||
        line.length % TIER_KEYS.length !== 0 ||
        line.some((value) => value.trim() === ""),
    )
    .map(([name]) => name)

/**
 * The same three tiers are named twice: in the send selector and in Settings → Fee rates,
 * where #4228 wraps them as "Onchain <tier> (~<window>)". The two screens have to use one
 * word per tier, so each Settings row is reduced to its bare tier word — the "Onchain"
 * marker and the window dropped — and compared with the selector's word.
 */
const TIER_WORD_PAIRS: [selectorKey: string, settingsKey: string][] = [
  ["SendBitcoinScreen.fast", "FeeRatesScreen.onchainPriority"],
  ["SendBitcoinScreen.medium", "FeeRatesScreen.onchainStandard"],
  ["SendBitcoinScreen.slow", "FeeRatesScreen.onchainEconomy"],
]

/**
 * Where a language inflects the tier word for what it qualifies, the two screens can
 * legitimately differ in the ending only. Keyed `<file>:<selectorKey>`, the value maps the
 * lower-cased selector form to the lower-cased Settings form it is accepted against.
 */
const TIER_WORD_AGREEMENT: Record<string, Record<string, string>> = {
  // The selector agrees with a feminine noun, the Settings row with a neuter one.
  "el.json:SendBitcoinScreen.medium": { κανονική: "κανονικό" },
  "el.json:SendBitcoinScreen.slow": { οικονομική: "οικονομικό" },
}

/**
 * Every spelling of "Onchain" the 28 Settings rows use today: `I-Onchain` in `xh`,
 * オンチェーン in `ja`, trailing in `ar`. A locale that spells it any other way fails with
 * a message naming this list — add the new spelling here.
 */
const ONCHAIN_MARKERS = ["I-Onchain", "Onchain", "オンチェーン"]

// The marker sits at one end of the label, so it is sliced off that end once rather
// than removed wherever it appears.
const withoutOnchainMarker = (value: string): string | undefined => {
  const marker = ONCHAIN_MARKERS.find((m) => value.startsWith(m) || value.endsWith(m))
  if (!marker) return undefined
  return value.startsWith(marker)
    ? value.slice(marker.length)
    : value.slice(0, -marker.length)
}

const tierWordMismatches = (localeFile: string, parsed: AnyTranslation): string[] => {
  const locale = localeOf(localeFile)

  return TIER_WORD_PAIRS.flatMap(([selectorKey, settingsKey]) => {
    const selectorLabel = String(leaf(parsed, selectorKey))
    const settingsLabel = String(leaf(parsed, settingsKey))
    const settingsWord = withoutOnchainMarker(
      settingsLabel.replace(/\s*\([^)]*\)\s*$/, "").trim(),
    )
    if (settingsWord === undefined) {
      return [
        `${settingsKey} "${settingsLabel}" has no Onchain marker in ONCHAIN_MARKERS`,
      ]
    }

    const selector = normalize(selectorLabel, locale)
    const agreed = TIER_WORD_AGREEMENT[`${localeFile}:${selectorKey}`]?.[selector]
    return (agreed ?? selector) === normalize(settingsWord, locale)
      ? []
      : [`${selectorKey} "${selectorLabel}" vs ${settingsKey} "${settingsLabel}"`]
  })
}

const localeFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()

describe("on-chain fee tier copy", () => {
  describe("the retired tier copy ledger", () => {
    it("records the tier names en ships today as en.current", () => {
      expect(LEDGER.en.current).toEqual(TIER_KEYS.map((key) => leaf(en, key)))
    })

    // Without this, a locale added after a rename can quietly opt out of the check below
    // by never being listed — the ledger only guards the files it names.
    it("has a line for every translation file and no other", () => {
      expect(Object.keys(LEDGER.locales).sort()).toEqual(localeFiles)
    })

    it("holds whole renames of non-empty strings on every line", () => {
      expect(malformedLedgerLines()).toEqual([])
    })
  })

  it("keys the agreement allowlist by lower-cased form, as the comparison reads it", () => {
    const notLowerCased = Object.entries(TIER_WORD_AGREEMENT).flatMap(([key, forms]) => {
      const locale = localeOf(key.split(":")[0])
      return Object.entries(forms)
        .filter(
          ([from, to]) =>
            from !== from.toLocaleLowerCase(locale) ||
            to !== to.toLocaleLowerCase(locale),
        )
        .map(([from]) => `${key}: ${from}`)
    })
    expect(notLowerCased).toEqual([])
  })

  localeFiles.forEach((localeFile) => {
    describe(localeFile, () => {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
      ) as AnyTranslation

      // A locale that kept its own translation of "Fast"/"Medium"/"Slow" keeps shipping the
      // queue-describing naming the on-chain tiers moved off, invisibly to `en`-only specs.
      it("carries no tier copy it or en has retired", () => {
        expect(supersededTierCopy(localeFile, parsed)).toEqual([])
      })

      it("names the on-chain fee tiers the same in the send selector and Settings", () => {
        expect(tierWordMismatches(localeFile, parsed)).toEqual([])
      })
    })
  })
})
