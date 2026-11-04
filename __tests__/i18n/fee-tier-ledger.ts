import retiredTierCopy from "./retired-tier-copy.json"

export type AnyTranslation = Record<string, unknown>

/** The `SendBitcoinScreen` keys both on-chain rails read their tier names from. */
export const TIER_KEY_NAMES = ["fast", "medium", "slow"]

export const TIER_KEYS = TIER_KEY_NAMES.map((name) => `SendBitcoinScreen.${name}`)

export const leaf = (node: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (at, part) =>
        at !== null && typeof at === "object" ? (at as AnyTranslation)[part] : undefined,
      node,
    )

export const normalize = (value: string, locale: string): string =>
  value.trim().toLocaleLowerCase(locale)

export type LocaleLine = { translatedFrom: string[]; retired: string[] }

/**
 * The retired tier copy ledger. `en.current` is what `en` ships; `en.retired` the words `en`
 * itself has dropped, one triple per rename. Each locale line records the `en` triple it
 * was last translated from, and its own outgoing strings, one triple per rename. So an `en`
 * rename fails every locale line until each one is revisited, and a locale still showing
 * one of its own retired strings is a locale the rename skipped (#3862).
 */
export type TierLedger = {
  en: { current: string[]; retired: string[] }
  locales: Record<string, LocaleLine>
}

const isTriples = (line: unknown): boolean =>
  Array.isArray(line) &&
  line.length > 0 &&
  line.length % TIER_KEYS.length === 0 &&
  line.every((value) => typeof value === "string" && value.trim() !== "")

/**
 * Names every line that is not whole triples of non-empty strings, rather than letting the
 * cases that read the ledger throw on it.
 */
export const malformedLedgerLines = (ledger: unknown): string[] => {
  const root = ledger as { en?: Record<string, unknown>; locales?: unknown } | null
  if (!root?.en) return ["en"]
  if (root.locales === null || typeof root.locales !== "object") return ["locales"]

  const lines: [string, unknown][] = [
    ["en.current", root.en.current],
    ["en.retired", root.en.retired],
    ...Object.entries(root.locales as Record<string, Partial<LocaleLine> | null>).flatMap(
      ([locale, line]): [string, unknown][] => [
        [`${locale}.translatedFrom`, line?.translatedFrom],
        [`${locale}.retired`, line?.retired],
      ],
    ),
  ]
  return lines.filter(([, line]) => !isTriples(line)).map(([name]) => name)
}

const sameWords = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((word, i) => word === b[i])

/** Locale lines last translated from a triple `en` no longer ships. */
export const staleLocaleLines = (ledger: TierLedger): string[] =>
  Object.entries(ledger.locales)
    .filter(([, line]) => !sameWords(line.translatedFrom, ledger.en.current))
    .map(([locale]) => locale)

/**
 * Locale lines holding fewer outgoing triples than `en` has had renames, so a rename was
 * recorded in `translatedFrom` without the words it retired.
 */
export const linesMissingARename = (ledger: TierLedger): string[] =>
  Object.entries(ledger.locales)
    .filter(([, line]) => line.retired.length !== ledger.en.retired.length)
    .map(([locale]) => locale)

/** Tier keys whose value is one of the locale's own retired strings. */
export const supersededTierCopy = (
  parsed: AnyTranslation,
  retired: string[],
  locale: string,
): string[] => {
  const outgoing = retired.map((value) => normalize(value, locale))

  return TIER_KEYS.filter((key) => {
    const value = leaf(parsed, key)
    return typeof value === "string" && outgoing.includes(normalize(value, locale))
  })
}

/**
 * The same three tiers are named twice: in the send selector and in Settings → Fee rates,
 * where #4228 wraps them as "Onchain <tier> (~<window>)". The two screens have to use one
 * word per tier, so each Settings row is reduced to its bare tier word — the "Onchain"
 * marker and the window dropped — and compared with the selector's word.
 */
export const TIER_WORD_PAIRS: [selectorKey: string, settingsKey: string][] = [
  ["SendBitcoinScreen.fast", "FeeRatesScreen.onchainPriority"],
  ["SendBitcoinScreen.medium", "FeeRatesScreen.onchainStandard"],
  ["SendBitcoinScreen.slow", "FeeRatesScreen.onchainEconomy"],
]

export type TierWordAgreement = Record<string, Record<string, string>>

/**
 * Where a language inflects the tier word for what it qualifies, the two screens can
 * legitimately differ in the ending only. Keyed `<locale>:<selectorKey>`, the value maps the
 * lower-cased selector form to a lower-cased Settings form accepted as an alternative to
 * the selector form itself, not instead of it.
 */
export const TIER_WORD_AGREEMENT: TierWordAgreement = {
  // The selector agrees with a feminine noun, the Settings row with a neuter one.
  "el:SendBitcoinScreen.medium": { κανονική: "κανονικό" },
  "el:SendBitcoinScreen.slow": { οικονομική: "οικονομικό" },
}

/**
 * Every spelling of "Onchain" the Settings rows use today: `I-Onchain` in `xh`,
 * オンチェーン in `ja`, and trailing rather than leading in `ar`'s Priority row. A locale
 * that spells it any other way fails with a message naming this list — add the new
 * spelling here.
 */
export const ONCHAIN_MARKERS = ["I-Onchain", "Onchain", "オンチェーン"]

// The marker sits at one end of the label, so it is sliced off that end once rather
// than removed wherever it appears.
export const withoutOnchainMarker = (value: string): string | undefined => {
  const marker = ONCHAIN_MARKERS.find((m) => value.startsWith(m) || value.endsWith(m))
  if (!marker) return undefined
  return value.startsWith(marker)
    ? value.slice(marker.length)
    : value.slice(0, -marker.length)
}

export const tierWordMismatches = (
  parsed: AnyTranslation,
  locale: string,
  agreement: TierWordAgreement = TIER_WORD_AGREEMENT,
): string[] =>
  TIER_WORD_PAIRS.flatMap(([selectorKey, settingsKey]) => {
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
    const settings = normalize(settingsWord, locale)
    const agreed = agreement[`${locale}:${selectorKey}`]?.[selector]
    return selector === settings || agreed === settings
      ? []
      : [`${selectorKey} "${selectorLabel}" vs ${settingsKey} "${settingsLabel}"`]
  })

export const LEDGER = retiredTierCopy as unknown as TierLedger
