import { WalletCurrency } from "@app/graphql/generated"

import { shouldHighlightById } from "@app/custodial/mappers/transaction-highlight"

const baseArgs = {
  txId: "id-5",
  settlementCurrency: WalletCurrency.Btc,
  walletFilter: "ALL" as WalletCurrency | "ALL",
  baselineBtcId: "id-3",
  baselineUsdId: "id-3",
  lastSeenIdForAll: "id-3",
  latestTxIdForCurrency: "id-9",
}

describe("shouldHighlightById on the ALL filter", () => {
  it("highlights a tx whose id is greater than both the currency and the aggregate baseline", () => {
    expect(shouldHighlightById({ ...baseArgs, txId: "id-5" })).toBe(true)
  })

  it("does not highlight a tx whose id is not greater than the currency baseline", () => {
    expect(shouldHighlightById({ ...baseArgs, txId: "id-1" })).toBe(false)
  })

  it("does not highlight a tx that beats the currency baseline but not the aggregate baseline", () => {
    expect(
      shouldHighlightById({
        ...baseArgs,
        baselineBtcId: "id-1",
        lastSeenIdForAll: "id-7",
        txId: "id-5",
      }),
    ).toBe(false)
  })

  it("falls back to id comparison when there is no aggregate baseline", () => {
    const args = { ...baseArgs, lastSeenIdForAll: "" }
    expect(shouldHighlightById({ ...args, txId: "id-5" })).toBe(true)
    expect(shouldHighlightById({ ...args, txId: "id-1" })).toBe(false)
  })

  it("highlights only the latest when the currency has never been seen", () => {
    const args = { ...baseArgs, lastSeenIdForAll: "", baselineBtcId: "" }
    expect(shouldHighlightById({ ...args, txId: "id-9" })).toBe(true)
    expect(shouldHighlightById({ ...args, txId: "id-5" })).toBe(false)
  })
})

describe("shouldHighlightById on a single-currency filter", () => {
  it("does not highlight a tx whose currency does not match the filter", () => {
    expect(
      shouldHighlightById({
        ...baseArgs,
        walletFilter: WalletCurrency.Usd,
        settlementCurrency: WalletCurrency.Btc,
      }),
    ).toBe(false)
  })

  it("highlights a tx newer than the matching-currency baseline", () => {
    expect(
      shouldHighlightById({
        ...baseArgs,
        walletFilter: WalletCurrency.Usd,
        settlementCurrency: WalletCurrency.Usd,
        baselineUsdId: "id-3",
        txId: "id-5",
      }),
    ).toBe(true)
  })

  it("does not highlight a tx not newer than the matching-currency baseline", () => {
    expect(
      shouldHighlightById({
        ...baseArgs,
        walletFilter: WalletCurrency.Usd,
        settlementCurrency: WalletCurrency.Usd,
        baselineUsdId: "id-7",
        txId: "id-5",
      }),
    ).toBe(false)
  })

  it("highlights only the latest when the matching currency has never been seen", () => {
    const args = {
      ...baseArgs,
      walletFilter: WalletCurrency.Usd,
      settlementCurrency: WalletCurrency.Usd,
      baselineUsdId: "",
    }
    expect(shouldHighlightById({ ...args, txId: "id-9" })).toBe(true)
    expect(shouldHighlightById({ ...args, txId: "id-5" })).toBe(false)
  })
})
