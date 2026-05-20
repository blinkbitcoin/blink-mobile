import {
  HomeAuthedDocument,
  PaymentSendResult,
  WalletCurrency,
} from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { ConvertDirection, PaymentResultStatus } from "@app/types/payment"
import { toWalletId } from "@app/types/wallet"

import {
  UnsupportedOperationError,
  createCustodialClaimDeposit,
  createCustodialConvert,
  createCustodialListPendingDeposits,
  type CustodialConvertDeps,
} from "@app/custodial/adapters/payment"

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

  it("refundDeposit throws UnsupportedOperationError", async () => {
    await expect(
      createCustodialClaimDeposit.refundDeposit({
        depositId: "d1",
        destinationAddress: "addr",
        feeRateSatPerVb: 1,
      }),
    ).rejects.toThrow(UnsupportedOperationError)
  })
})

const btcWalletId = toWalletId("btc-wallet-id")
const usdWalletId = toWalletId("usd-wallet-id")

const buildDeps = (
  overrides: Partial<CustodialConvertDeps> = {},
): CustodialConvertDeps => ({
  intraLedgerPaymentSend: jest.fn(),
  intraLedgerUsdPaymentSend: jest.fn(),
  btcWalletId,
  usdWalletId,
  ...overrides,
})

describe("createCustodialConvert — getQuote", () => {
  it("returns a quote with zero USD fee", async () => {
    const deps = buildDeps()

    const quote = await createCustodialConvert(deps).getQuote({
      fromAmount: toBtcMoneyAmount(1000),
      toAmount: toUsdMoneyAmount(25),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(quote).not.toBeNull()
    expect(quote!.feeAmount.amount).toBe(0)
    expect(quote!.feeAmount.currency).toBe(WalletCurrency.Usd)
  })
})

describe("createCustodialConvert — execute (BTC → USD)", () => {
  it("invokes intraLedgerPaymentSend with the BTC wallet as source and USD wallet as recipient", async () => {
    const intraLedgerPaymentSend = jest.fn().mockResolvedValue({
      data: { intraLedgerPaymentSend: { status: PaymentSendResult.Success, errors: [] } },
    })
    const deps = buildDeps({ intraLedgerPaymentSend })

    const quote = await createCustodialConvert(deps).getQuote({
      fromAmount: toBtcMoneyAmount(1000),
      toAmount: toUsdMoneyAmount(25),
      direction: ConvertDirection.BtcToUsd,
    })
    const result = await quote!.execute()

    expect(intraLedgerPaymentSend).toHaveBeenCalledWith({
      variables: {
        input: {
          walletId: btcWalletId,
          recipientWalletId: usdWalletId,
          amount: 1000,
        },
      },
      refetchQueries: [HomeAuthedDocument],
    })
    expect(result.status).toBe(PaymentResultStatus.Success)
  })

  it("surfaces a failed status with the Apollo error message when mutation reports a domain error", async () => {
    const intraLedgerPaymentSend = jest.fn().mockResolvedValue({
      data: {
        intraLedgerPaymentSend: {
          status: PaymentSendResult.Failure,
          errors: [{ message: "Insufficient balance" }],
        },
      },
    })
    const deps = buildDeps({ intraLedgerPaymentSend })

    const quote = await createCustodialConvert(deps).getQuote({
      fromAmount: toBtcMoneyAmount(1000),
      toAmount: toUsdMoneyAmount(25),
      direction: ConvertDirection.BtcToUsd,
    })
    const result = await quote!.execute()

    expect(result.status).toBe(PaymentResultStatus.Failed)
    expect(result.errors?.[0].message).toBe("Insufficient balance")
  })

  it("returns failed when status is missing from the mutation response", async () => {
    const intraLedgerPaymentSend = jest.fn().mockResolvedValue({ data: undefined })
    const deps = buildDeps({ intraLedgerPaymentSend })

    const quote = await createCustodialConvert(deps).getQuote({
      fromAmount: toBtcMoneyAmount(1000),
      toAmount: toUsdMoneyAmount(25),
      direction: ConvertDirection.BtcToUsd,
    })
    const result = await quote!.execute()

    expect(result.status).toBe(PaymentResultStatus.Failed)
  })
})

describe("createCustodialConvert — execute (USD → BTC)", () => {
  it("invokes intraLedgerUsdPaymentSend with USD wallet as source and BTC wallet as recipient", async () => {
    const intraLedgerUsdPaymentSend = jest.fn().mockResolvedValue({
      data: {
        intraLedgerUsdPaymentSend: { status: PaymentSendResult.Success, errors: [] },
      },
    })
    const deps = buildDeps({ intraLedgerUsdPaymentSend })

    const quote = await createCustodialConvert(deps).getQuote({
      fromAmount: toUsdMoneyAmount(500),
      toAmount: toBtcMoneyAmount(900),
      direction: ConvertDirection.UsdToBtc,
    })
    const result = await quote!.execute()

    expect(intraLedgerUsdPaymentSend).toHaveBeenCalledWith({
      variables: {
        input: {
          walletId: usdWalletId,
          recipientWalletId: btcWalletId,
          amount: 500,
        },
      },
      refetchQueries: [HomeAuthedDocument],
    })
    expect(result.status).toBe(PaymentResultStatus.Success)
  })
})
