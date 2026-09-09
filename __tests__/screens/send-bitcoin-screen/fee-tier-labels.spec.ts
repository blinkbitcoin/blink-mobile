import enBase from "@app/i18n/en"
import { type Translations } from "@app/i18n/i18n-types"

import { buildFeeTierOptions } from "@app/screens/send-bitcoin-screen/fee-tier-options"
import {
  FeeTierOption,
  FeeUnit,
  buildZeroTiers,
} from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { CUSTODIAL_PAYOUT_ETA_MINUTES } from "@app/screens/send-bitcoin-screen/hooks/use-custodial-onchain-fee-tiers"

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test",
}))

/** The source file is typed as the loose BaseTranslation; the generated shape is the real one. */
const en = enBase as unknown as Translations

/**
 * The wiring specs mock both the copy and the ETAs, so nothing there would notice the tier
 * names or the confirmation windows drifting. This one asserts the shipped English strings
 * and the shipped payout windows against what the sender is promised on screen, so a
 * rename or a re-timing has to be made here deliberately rather than in passing.
 */
describe("on-chain fee tier presentation", () => {
  const labels = {
    [FeeTierOption.Fast]: en.SendBitcoinScreen.fast,
    [FeeTierOption.Medium]: en.SendBitcoinScreen.medium,
    [FeeTierOption.Slow]: en.SendBitcoinScreen.slow,
  }

  const buildOptions = () =>
    buildFeeTierOptions({
      tiers: buildZeroTiers(CUSTODIAL_PAYOUT_ETA_MINUTES, FeeUnit.Sats),
      labels,
      formatFee: ({ feeAmount }) => `${feeAmount} sats`,
      locale: "en",
      // The names and the windows are what a tier reads as before any quote lands.
      hasQuote: false,
    })

  it("names the tiers Priority, Standard and Economy, in that order", () => {
    expect(buildOptions().map((option) => option.label)).toEqual([
      "Priority",
      "Standard",
      "Economy",
    ])
  })

  it("promises ~ 10m, ~ 4h and ~ 24h against those names", () => {
    expect(
      buildOptions().map((option) => ({ label: option.label, detail: option.detail })),
    ).toEqual([
      { label: "Priority", detail: "~ 10m" },
      { label: "Standard", detail: "~ 4h" },
      { label: "Economy", detail: "~ 24h" },
    ])
  })

  it("keeps the tier ids the payout speeds are keyed on", () => {
    // The copy is free to change; these ids pick the backend queue, so they are not.
    expect(buildOptions().map((option) => option.id)).toEqual(["fast", "medium", "slow"])
  })

  it("leaves no superseded tier name in the on-chain copy", () => {
    expect(Object.values(labels)).not.toContain("Fast")
    expect(Object.values(labels)).not.toContain("Medium")
    expect(Object.values(labels)).not.toContain("Slow")
  })
})
