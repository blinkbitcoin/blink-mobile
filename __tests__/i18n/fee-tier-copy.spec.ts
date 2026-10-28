import { it } from "@jest/globals"

import fs from "fs"
import path from "path"

import en from "@app/i18n/en"

import {
  type AnyTranslation,
  LEDGER,
  type TierLedger,
  TIER_KEYS,
  TIER_WORD_AGREEMENT,
  leaf,
  linesMissingARename,
  malformedLedgerLines,
  normalize,
  staleLocaleLines,
  supersededTierCopy,
  tierWordMismatches,
} from "./fee-tier-ledger"

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

const localeOf = (localeFile: string): string => localeFile.replace(/\.json$/, "")

const localeFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()

const TRIPLE = ["Priority", "Standard", "Economy"]

const ledgerWith = (locales: TierLedger["locales"]): TierLedger => ({
  en: { current: TRIPLE, retired: ["Fast", "Medium", "Slow"] },
  locales,
})

const translation = (
  [fast, medium, slow]: string[],
  [priority, standard, economy]: string[],
): AnyTranslation => ({
  SendBitcoinScreen: { fast, medium, slow },
  FeeRatesScreen: {
    onchainPriority: priority,
    onchainStandard: standard,
    onchainEconomy: economy,
  },
})

const SETTINGS = [
  "Onchain Priority (~10m)",
  "Onchain Standard (~4h)",
  "Onchain Economy (~24h)",
]

describe("on-chain fee tier copy", () => {
  describe("the retired tier copy ledger", () => {
    it("holds whole triples of non-empty strings on every line", () => {
      expect(malformedLedgerLines(LEDGER)).toEqual([])
    })

    it("records the tier names en ships today as en.current", () => {
      expect(LEDGER.en.current).toEqual(TIER_KEYS.map((key) => leaf(en, key)))
    })

    it("never brings a retired en tier name back as a current one", () => {
      const retired = LEDGER.en.retired.map((word) => normalize(word, "en"))
      expect(
        LEDGER.en.current.filter((word) => retired.includes(normalize(word, "en"))),
      ).toEqual([])
    })

    // Without this, a locale added after a rename can quietly opt out of the checks below
    // by never being listed — the ledger only guards the locales it names.
    it("has a line for every translation file and no other", () => {
      expect(Object.keys(LEDGER.locales).sort()).toEqual(localeFiles.map(localeOf))
    })

    // An en rename changes en.current, which fails every line here until each locale is
    // revisited for the new words — a 28-line diff rather than a one-line bump.
    it("has every locale line translated from the tier names en ships", () => {
      expect(staleLocaleLines(LEDGER)).toEqual([])
    })

    it("records one outgoing triple per en rename on every locale line", () => {
      expect(linesMissingARename(LEDGER)).toEqual([])
    })
  })

  describe("the ledger checks", () => {
    it.each<[string, unknown, string[]]>([
      [
        "a well-formed ledger",
        ledgerWith({ es: { translatedFrom: TRIPLE, retired: ["a", "b", "c"] } }),
        [],
      ],
      ["a missing en", { locales: {} }, ["en"]],
      ["missing locales", { en: { current: TRIPLE, retired: TRIPLE } }, ["locales"]],
      [
        "a line that is not an array",
        ledgerWith({
          es: { translatedFrom: TRIPLE, retired: "abc" as unknown as string[] },
        }),
        ["es.retired"],
      ],
      [
        "a partial rename",
        ledgerWith({ es: { translatedFrom: TRIPLE, retired: ["a", "b"] } }),
        ["es.retired"],
      ],
      [
        "an empty string",
        ledgerWith({ es: { translatedFrom: ["", "b", "c"], retired: ["a", "b", "c"] } }),
        ["es.translatedFrom"],
      ],
    ])("names the malformed lines in %s", (_, ledger, expected) => {
      expect(malformedLedgerLines(ledger)).toEqual(expected)
    })

    it("flags a locale line translated from an older en triple", () => {
      const ledger = ledgerWith({
        es: { translatedFrom: TRIPLE, retired: ["a", "b", "c"] },
        fr: { translatedFrom: ["Fast", "Medium", "Slow"], retired: ["a", "b", "c"] },
      })
      expect(staleLocaleLines(ledger)).toEqual(["fr"])
    })

    it("flags a locale line that skipped recording a rename's outgoing words", () => {
      const ledger: TierLedger = {
        en: { current: TRIPLE, retired: ["Fast", "Medium", "Slow", "A", "B", "C"] },
        locales: { es: { translatedFrom: TRIPLE, retired: ["a", "b", "c"] } },
      }
      expect(linesMissingARename(ledger)).toEqual(["es"])
    })

    it.each<[string, string[], string[]]>([
      [
        "a current value equal to a retired one",
        ["Rápido", "Normal", "Económica"],
        ["SendBitcoinScreen.fast"],
      ],
      [
        "a retired value moved to another tier",
        ["Prioridad", "Lento", "Económica"],
        ["SendBitcoinScreen.medium"],
      ],
      [
        "a retired value in another case",
        ["RÁPIDO", "Normal", "Económica"],
        ["SendBitcoinScreen.fast"],
      ],
      // en.retired is no longer a ban list for other locales: "Medium" is ordinary Dutch.
      ["a native word that en has retired", ["Prioriteit", "Medium", "Zuinig"], []],
      ["fully revisited copy", ["Prioridad", "Normal", "Económica"], []],
    ])("checks a locale against its own retired copy: %s", (_, tiers, expected) => {
      expect(
        supersededTierCopy(
          translation(tiers, SETTINGS),
          ["Rápido", "Medio", "Lento"],
          "es",
        ),
      ).toEqual(expected)
    })

    const agreement = { "el:SendBitcoinScreen.medium": { κανονική: "κανονικό" } }
    const elTiers = (medium: string, standard: string) =>
      translation(
        ["Προτεραιότητα", medium, "Οικονομική"],
        ["Onchain Προτεραιότητα", `Onchain ${standard} (~4ω)`, "Onchain Οικονομική"],
      )

    it.each<[string, AnyTranslation, string[]]>([
      ["the same word", translation(TRIPLE, SETTINGS), []],
      [
        "the same word in another case",
        translation(["PRIORITY", "standard", "Economy"], SETTINGS),
        [],
      ],
      [
        "a trailing marker",
        translation(TRIPLE, ["Priority Onchain (~10m)", SETTINGS[1], SETTINGS[2]]),
        [],
      ],
      [
        "a different word",
        translation(["Express", "Standard", "Economy"], SETTINGS),
        [
          'SendBitcoinScreen.fast "Express" vs FeeRatesScreen.onchainPriority "Onchain Priority (~10m)"',
        ],
      ],
      [
        "a Settings row without a known marker",
        translation(TRIPLE, ["On-chain Priority (~10m)", SETTINGS[1], SETTINGS[2]]),
        [
          'FeeRatesScreen.onchainPriority "On-chain Priority (~10m)" has no Onchain marker in ONCHAIN_MARKERS',
        ],
      ],
    ])("compares the selector and Settings words: %s", (_, parsed, expected) => {
      expect(tierWordMismatches(parsed, "en", agreement)).toEqual(expected)
    })

    it.each<[string, AnyTranslation, string[]]>([
      ["an allowlisted inflection", elTiers("Κανονική", "Κανονικό"), []],
      [
        "an allowlisted locale using the selector's form on both screens",
        elTiers("Κανονική", "κανονική"),
        [],
      ],
      [
        "an allowlisted locale using an unrelated word",
        elTiers("Κανονική", "Αργή"),
        [
          'SendBitcoinScreen.medium "Κανονική" vs FeeRatesScreen.onchainStandard "Onchain Αργή (~4ω)"',
        ],
      ],
    ])("accepts either form an allowlist entry names: %s", (_, parsed, expected) => {
      expect(tierWordMismatches(parsed, "el", agreement)).toEqual(expected)
    })
  })

  it("keys the agreement allowlist by lower-cased form, as the comparison reads it", () => {
    const notLowerCased = Object.entries(TIER_WORD_AGREEMENT).flatMap(([key, forms]) => {
      const locale = key.split(":")[0]
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

  // en is held to the same one-word-per-tier rule as every translation, so an English
  // rename has to reach Settings too.
  it("names the on-chain fee tiers the same in the en send selector and Settings", () => {
    expect(tierWordMismatches(en as unknown as AnyTranslation, "en")).toEqual([])
  })

  localeFiles.forEach((localeFile) => {
    const locale = localeOf(localeFile)

    describe(localeFile, () => {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
      ) as AnyTranslation

      // A locale that kept its own translation of "Fast"/"Medium"/"Slow" keeps shipping the
      // queue-describing naming the on-chain tiers moved off, invisibly to `en`-only specs.
      it("carries no tier copy it has retired", () => {
        expect(
          supersededTierCopy(parsed, LEDGER.locales[locale]?.retired ?? [], locale),
        ).toEqual([])
      })

      it("names the on-chain fee tiers the same in the send selector and Settings", () => {
        expect(tierWordMismatches(parsed, locale)).toEqual([])
      })
    })
  })
})
