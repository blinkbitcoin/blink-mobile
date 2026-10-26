import enBase from "@app/i18n/en"
import { type Translations } from "@app/i18n/i18n-types"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import {
  buildFeeTierOptions,
  feeTierLabels,
} from "@app/screens/send-bitcoin-screen/fee-tier-options"
import {
  FeeTierOption,
  FeeUnit,
  buildZeroTiers,
} from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { CUSTODIAL_PAYOUT_ETA_MINUTES } from "@app/screens/send-bitcoin-screen/hooks/use-custodial-onchain-fee-tiers"
import { FEE_TIER_ETA_MINUTES } from "@app/types/payment"

import { LEDGER, TIER_KEY_NAMES } from "../../i18n/fee-tier-ledger"

/**
 * The source file is typed as the loose BaseTranslation; the generated shape is the real
 * one. Narrowed to the two sections this spec reads, so the reads below stay type-checked.
 */
const en = enBase as unknown as Pick<
  Translations,
  "SendBitcoinScreen" | "UnclaimedDeposit" | "FeeRatesScreen"
>
const sendScreen = en.SendBitcoinScreen

loadLocale("en")

/** The label map both rails build their tiers from, read through the shipped `en` copy. */
const labels = feeTierLabels(i18nObject("en"))

/** Words these tiers have been called before. None of them may reach a screen again. */
const SUPERSEDED_TIER_NAMES = LEDGER.en.retired

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Whole-word so "Fast" does not match "Fastest" only by accident, and vice versa. */
const survivingTierNames = (copy: string[]): string[] =>
  SUPERSEDED_TIER_NAMES.filter((name) =>
    copy.some((line) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(line)),
  )

/**
 * Only the copy that names a tier or a fee rate. Elsewhere in these sections "fast" and
 * "slow" are ordinary words a sentence about confirmation times may need.
 */
const isTierCopyKey = (key: string): boolean =>
  /feeRate|tier/i.test(key) || TIER_KEY_NAMES.includes(key)

const presentTiers = (etaMinutes: Record<FeeTierOption, number>) =>
  buildFeeTierOptions({
    tiers: buildZeroTiers(etaMinutes, FeeUnit.Sats),
    labels,
    formatFee: ({ feeAmount }) => `${feeAmount} sats`,
    locale: "en",
    // The names and the windows are what a tier reads as before any quote lands.
    hasQuote: false,
  })

/**
 * The wiring specs mock both the copy and the ETAs, so nothing there would notice the tier
 * names or the confirmation windows drifting. This one asserts the shipped English strings
 * and the shipped payout windows against what the sender is promised on screen, so a
 * rename or a re-timing has to be made here deliberately rather than in passing.
 */
describe("on-chain fee tier presentation", () => {
  describe("custodial payout queues", () => {
    it("promises Priority ~ 10m, Standard ~ 4h and Economy ~ 24h, in that order", () => {
      expect(
        presentTiers(CUSTODIAL_PAYOUT_ETA_MINUTES).map(({ label, detail }) => ({
          label,
          detail,
        })),
      ).toEqual([
        { label: "Priority", detail: "~ 10m" },
        { label: "Standard", detail: "~ 4h" },
        { label: "Economy", detail: "~ 24h" },
      ])
    })

    // Settings → Fee rates promises the same windows as "Onchain <tier> (~<window>)", so a
    // re-timed queue has to reach that copy too, not just the selector.
    it("promises the same windows in Settings → Fee rates", () => {
      const settingsWindows = [
        en.FeeRatesScreen.onchainPriority,
        en.FeeRatesScreen.onchainStandard,
        en.FeeRatesScreen.onchainEconomy,
      ].map((row) => row.match(/\(([^)]*)\)$/)?.[1])

      expect(settingsWindows).toEqual(
        presentTiers(CUSTODIAL_PAYOUT_ETA_MINUTES).map(({ detail }) =>
          detail.replace(/^~ /, "~"),
        ),
      )
    })

    it("keeps the tier ids the payout speeds are keyed on", () => {
      // The copy is free to change; these ids pick the backend queue, so they are not.
      expect(presentTiers(CUSTODIAL_PAYOUT_ETA_MINUTES).map(({ id }) => id)).toEqual([
        "fast",
        "medium",
        "slow",
      ])
    })
  })

  /**
   * The self-custodial send and refund rails broadcast straight from the SDK against
   * mempool's rates, so they share the names but not the windows. Nothing else in the suite
   * reads FEE_TIER_ETA_MINUTES from source — re-timing a tier there was invisible.
   */
  describe("self-custodial mempool rates", () => {
    it("promises Priority ~ 10m, Standard ~ 30m and Economy ~ 60m, in that order", () => {
      expect(
        presentTiers(FEE_TIER_ETA_MINUTES).map(({ label, detail }) => ({
          label,
          detail,
        })),
      ).toEqual([
        { label: "Priority", detail: "~ 10m" },
        { label: "Standard", detail: "~ 30m" },
        { label: "Economy", detail: "~ 60m" },
      ])
    })
  })

  describe("the copy around the tiers", () => {
    it("leaves no superseded tier name standing in the tier, heading and fee rate copy", () => {
      const onchainCopy = Object.entries({
        ...sendScreen,
        ...en.UnclaimedDeposit,
      })
        .filter(([key]) => isTierCopyKey(key))
        .map(([, value]) => value)
        .filter((value): value is string => typeof value === "string")

      expect(survivingTierNames(onchainCopy)).toEqual([])
    })
  })
})
