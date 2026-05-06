import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import {
  ConvertDirection,
  FeeQuoteType,
  PaymentResultStatus,
} from "@app/types/payment.types"

import {
  UnsupportedOperationError,
  createCustodialClaimDeposit,
  createCustodialConvert,
  createCustodialGetFee,
  createCustodialListPendingDeposits,
  createCustodialReceiveLightning,
  createCustodialReceiveOnchain,
  createCustodialSendPayment,
} from "@app/custodial/adapters/payment-adapter"

describe("createCustodialSendPayment", () => {
  it("maps SUCCESS to success", async () => {
    const mutation = jest.fn().mockResolvedValue({
      status: PaymentSendResult.Success,
      errors: [],
    })
    const adapter = createCustodialSendPayment(mutation)

    const result = await adapter({ destination: "lnbc1..." })

    expect(result.status).toBe(PaymentResultStatus.Success)
    expect(mutation).toHaveBeenCalledWith({
      destination: "lnbc1...",
      amount: undefined,
      memo: undefined,
    })
  })

  it("maps PENDING to pending", async () => {
    const mutation = jest.fn().mockResolvedValue({
      status: PaymentSendResult.Pending,
      errors: [],
    })
    const adapter = createCustodialSendPayment(mutation)

    const result = await adapter({ destination: "lnbc1..." })

    expect(result.status).toBe(PaymentResultStatus.Pending)
  })

  it("maps FAILURE to failed", async () => {
    const mutation = jest.fn().mockResolvedValue({
      status: PaymentSendResult.Failure,
      errors: [{ message: "Insufficient balance" }],
    })
    const adapter = createCustodialSendPayment(mutation)

    const result = await adapter({ destination: "lnbc1..." })

    expect(result.status).toBe(PaymentResultStatus.Failed)
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0].message).toBe("Insufficient balance")
  })

  it("passes amount and memo to mutation", async () => {
    const mutation = jest.fn().mockResolvedValue({
      status: PaymentSendResult.Success,
      errors: [],
    })
    const adapter = createCustodialSendPayment(mutation)

    await adapter({
      destination: "lnbc1...",
      amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      memo: "test memo",
    })

    expect(mutation).toHaveBeenCalledWith({
      destination: "lnbc1...",
      amount: 1000,
      memo: "test memo",
    })
  })
})

describe("createCustodialGetFee", () => {
  it("returns fee quote for lightning", async () => {
    const mutation = jest.fn().mockResolvedValue({ amount: 5 })
    const adapter = createCustodialGetFee(mutation)

    const result = await adapter({ destination: "lnbc1..." })

    expect(result).not.toBeNull()
    expect(result?.paymentType).toBe(FeeQuoteType.Lightning)
    expect(result?.feeAmount.amount).toBe(5)
  })

  it("returns null when mutation returns null", async () => {
    const mutation = jest.fn().mockResolvedValue(null)
    const adapter = createCustodialGetFee(mutation)

    const result = await adapter({ destination: "lnbc1..." })

    expect(result).toBeNull()
  })
})

describe("createCustodialReceiveLightning", () => {
  it("returns invoice on success", async () => {
    const mutation = jest.fn().mockResolvedValue({ invoice: "lnbc1invoice..." })
    const adapter = createCustodialReceiveLightning(mutation)

    const result = await adapter({})

    expect(result.invoice).toBe("lnbc1invoice...")
    expect(result.errors).toBeUndefined()
  })

  it("returns error when mutation returns null", async () => {
    const mutation = jest.fn().mockResolvedValue(null)
    const adapter = createCustodialReceiveLightning(mutation)

    const result = await adapter({})

    expect(result.invoice).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0].message).toBe("Failed to create invoice")
  })
})

describe("createCustodialReceiveOnchain", () => {
  it("returns address on success", async () => {
    const mutation = jest.fn().mockResolvedValue({ address: "bc1q..." })
    const adapter = createCustodialReceiveOnchain(mutation)

    const result = await adapter()

    expect(result.address).toBe("bc1q...")
    expect(result.errors).toBeUndefined()
  })

  it("returns error when mutation returns null", async () => {
    const mutation = jest.fn().mockResolvedValue(null)
    const adapter = createCustodialReceiveOnchain(mutation)

    const result = await adapter()

    expect(result.address).toBeUndefined()
    expect(result.errors).toHaveLength(1)
  })
})

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
      amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe(PaymentResultStatus.Failed)
    expect(result.errors).toHaveLength(1)
  })
})
