import { WalletCurrency } from "@app/graphql/generated"
import { ConvertDirection, PaymentResultStatus } from "@app/types/payment"

import {
  UnsupportedOperationError,
  createCustodialClaimDeposit,
  createCustodialConvert,
  createCustodialListPendingDeposits,
} from "@app/custodial/adapters/payment-adapter"

describe("createCustodialListPendingDeposits", () => {
  it("returns empty deposits", async () => {
    const result = await createCustodialListPendingDeposits()

    expect(result.deposits).toHaveLength(0)
    expect(result.errors).toBeUndefined()
  })
})

describe("createCustodialClaimDeposit", () => {
  it("getClaimFee throws UnsupportedOperationError", async () => {
    await expect(
      createCustodialClaimDeposit.getClaimFee({ depositId: "d1" }),
    ).rejects.toThrow(UnsupportedOperationError)
  })

  it("claimDeposit throws UnsupportedOperationError", async () => {
    await expect(
      createCustodialClaimDeposit.claimDeposit({ depositId: "d1" }),
    ).rejects.toThrow(UnsupportedOperationError)
  })
})

describe("createCustodialConvert", () => {
  it("returns failed status", async () => {
    const result = await createCustodialConvert({
      fromAmount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      toAmount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe(PaymentResultStatus.Failed)
    expect(result.errors).toHaveLength(1)
  })
})
