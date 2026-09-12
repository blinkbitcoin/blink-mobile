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

const collectLeafPaths = (node: unknown, prefix = ""): string[] => {
  if (node === null || typeof node !== "object") return [prefix]
  const obj = node as AnyTranslation
  return Object.keys(obj)
    .sort()
    .flatMap((key) => collectLeafPaths(obj[key], prefix ? `${prefix}.${key}` : key))
}

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
 * typesafe-i18n placeholders carry an optional type and formatter chain —
 * `{amount}`, `{limit: string}`, `{count:number|sats}`. Only the argument name
 * has to survive translation, so compare on that alone.
 */
const placeholderNames = (value: unknown): string[] =>
  typeof value === "string"
    ? [...value.matchAll(/\{([^}]*)\}/g)]
        .map((match) => match[1].split(/[:|]/)[0].trim())
        .sort()
    : []

/**
 * Placeholder drift that predates this check. These locales render a literal
 * "{amount}" to users, or silently drop an interpolated value — real bugs, but
 * translation fixes rather than code ones, so they are recorded here instead of
 * blocking the suite. The list is a ratchet: it may shrink, never grow. Delete
 * an entry as soon as the locale is corrected.
 */
const KNOWN_PLACEHOLDER_DRIFT = new Set([
  "af.json:SendBitcoinDestinationScreen.usernameNowAddressInfo",
  "af.json:TransactionDetailScreen.txNotBroadcast",
  "ar.json:TransactionDetailScreen.txNotBroadcast",
  "ca.json:PhoneLoginValidationScreen.sendViaOtherChannel",
  "cs.json:TransactionDetailScreen.txNotBroadcast",
  "el.json:ReceiveScreen.invoiceValidity.validBefore",
  "es.json:SendBitcoinDestinationScreen.usernameNowAddressInfo",
  "fr.json:TransactionDetailScreen.txNotBroadcast",
  "hr.json:SendBitcoinDestinationScreen.destinationOptions",
  "hr.json:TransactionDetailScreen.txNotBroadcast",
  "hy.json:TransactionDetailScreen.txNotBroadcast",
  "id.json:ContactDetailsScreen.title",
  "id.json:EarnScreen.earnSats",
  "it.json:ReceiveScreen.invoiceValidity.expiresIn",
  "ja.json:TransactionDetailScreen.txNotBroadcast",
  "lg.json:support.defaultSupportMessage",
  "ms.json:EarnScreen.satsEarned",
  "ms.json:PhoneLoginValidationScreen.sendViaOtherChannel",
  "ms.json:PinScreen.attemptsRemaining",
  "ms.json:ReceiveScreen.invoiceValidity.expiresIn",
  "ms.json:ReceiveScreen.invoiceValidity.validBefore",
  "ms.json:ReceiveScreen.invoiceValidity.validForNext",
  "ms.json:RedeemBitcoinScreen.minMaxRange",
  "ms.json:RedeemBitcoinScreen.redeemAmountFrom",
  "ms.json:ScanningQRCodeScreen.expiredContent",
  "ms.json:ScanningQRCodeScreen.invalidContent",
  "ms.json:ScanningQRCodeScreen.invalidContentLnurl",
  "ms.json:SendBitcoinConfirmationScreen.stalePrice",
  "ms.json:TransactionDetailScreen.txNotBroadcast",
  "nl.json:TransactionDetailScreen.txNotBroadcast",
  "pt.json:AmountInputScreen.minAmountNotMet",
  "pt.json:ScanningQRCodeScreen.expiredContent",
  "qu.json:TransactionDetailScreen.txNotBroadcast",
  "ro.json:SendBitcoinConfirmationScreen.totalExceed",
  "sr.json:TransactionDetailScreen.txNotBroadcast",
  "th.json:TransactionDetailScreen.txNotBroadcast",
  "tr.json:RedeemBitcoinScreen.redeemAmountFrom",
  "vi.json:SendBitcoinDestinationScreen.destinationOptions",
  "vi.json:TransactionDetailScreen.txNotBroadcast",
  "xh.json:EarnScreen.earnSats",
  "xh.json:ScanningQRCodeScreen.expiredContent",
  "xh.json:ScanningQRCodeScreen.invalidContent",
  "xh.json:ScanningQRCodeScreen.invalidContentLnurl",
  "xh.json:SendBitcoinDestinationScreen.newBankAddressUsername",
  "xh.json:SendBitcoinDestinationScreen.usernameNowAddress",
  "xh.json:SettingsScreen.rateUs",
  "xh.json:TransactionDetailScreen.txNotBroadcast",
])

const sourceLeafPaths = new Set(collectLeafPaths(en))
const sourceLeaves = collectLeaves(en)

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

const placeholderDrift = (localeFile: string, parsed: AnyTranslation): string[] => {
  const localeLeaves = collectLeaves(parsed)
  const hasDrifted = (key: string): boolean =>
    key in localeLeaves &&
    !KNOWN_PLACEHOLDER_DRIFT.has(`${localeFile}:${key}`) &&
    placeholderNames(sourceLeaves[key]).join(",") !==
      placeholderNames(localeLeaves[key]).join(",")

  return Object.keys(sourceLeaves).filter(hasDrifted)
}

/**
 * Words the on-chain fee tiers have been called in English before. A locale holding one of
 * these is an untranslated fallback left behind by a copy change (#3862) — it ships the
 * old words to that locale's senders while `en` reads correctly. Key parity above already
 * forbids omitting the keys, so a locale has to carry *something*; this says what it may
 * not carry.
 *
 * This catches only the locales that never translated the tier at all. A locale that *did*
 * translate it keeps a word no English list can predict — `es` held "Rápido", `de` held
 * "Schnell", `ja` held "高速" — so the per-locale ledger below carries those.
 */
const SUPERSEDED_TIER_NAMES = ["Fast", "Medium", "Slow", "Fastest", "Normal", "Flexible"]

/**
 * Per-locale tier copy this app has already retired, keyed by translation file. The
 * invariant the tier keys actually need is cross-version — "when `en`'s tier copy changes,
 * every locale's changes with it" — and a spec that only ever sees the working tree cannot
 * observe a change. This approximates it with state: each rename appends that rename's
 * outgoing strings here, and a locale whose current value is still one of its own retired
 * ones is a locale the rename skipped.
 *
 * The ledger is append-only and grows by three entries per locale per rename, which is the
 * point — the omission a reviewer would otherwise have to notice by reading 28 files shows
 * up as a missing line in this diff. Seeded at `ef449120d` with the
 * Fast / Medium / Slow generation.
 */
const RETIRED_TIER_COPY = retiredTierCopy as Record<string, string[]>

const TIER_KEYS = [
  "SendBitcoinScreen.fast",
  "SendBitcoinScreen.medium",
  "SendBitcoinScreen.slow",
]

const normalize = (value: string): string => value.trim().toLowerCase()

const supersededTierCopy = (localeFile: string, parsed: AnyTranslation): string[] => {
  const localeLeaves = collectLeaves(parsed)
  const retired = [
    ...SUPERSEDED_TIER_NAMES,
    ...(RETIRED_TIER_COPY[localeFile] ?? []),
  ].map(normalize)

  return TIER_KEYS.filter((key) => {
    const value = localeLeaves[key]
    return typeof value === "string" && retired.includes(normalize(value))
  })
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

      // Key parity alone lets a locale keep the key and lose the value it
      // interpolates: "USD {limit} per day" becomes a stale hardcoded amount, or
      // the literal "{limit: string}" is shown to users. Both ship green without
      // this.
      it("interpolates the same placeholders as the English source", () => {
        expect(placeholderDrift(localeFile, parsed)).toEqual([])
      })

      // A locale that kept its own translation of "Fast"/"Medium"/"Slow" keeps shipping the
      // queue-describing naming the on-chain tiers moved off, invisibly to `en`-only specs.
      it("carries no superseded on-chain fee tier name", () => {
        expect(supersededTierCopy(localeFile, parsed)).toEqual([])
      })

      // Without this, a locale added after a rename can quietly opt out of the check above
      // by never being listed — the ledger only guards the files it names.
      it("is covered by the retired tier copy ledger", () => {
        expect(Object.keys(RETIRED_TIER_COPY)).toContain(localeFile)
      })
    })
  })
})
