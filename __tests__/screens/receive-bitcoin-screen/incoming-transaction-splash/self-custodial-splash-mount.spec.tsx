import React from "react"
import { act, render } from "@testing-library/react-native"
import { it } from "@jest/globals"
import { type DepositInfo, type Payment } from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { IncomingTransactionSplashContext } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/incoming-transaction-splash-context"
import { SelfCustodialSplashMount } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/self-custodial-splash-mount"
import { emitNewDeposits } from "@app/self-custodial/providers/new-deposits"
import {
  emitSucceededPayment,
  notePendingPayment,
} from "@app/self-custodial/providers/succeeded-payments"
import { toWalletMoneyAmount } from "@app/types/amounts"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"

jest.mock("@react-native-firebase/crashlytics", () => ({
  getCrashlytics: jest.fn(),
  log: jest.fn(),
  recordError: jest.fn(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: true }),
}))
jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: undefined, displayCurrency: "USD" }),
}))
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ fractionDigits: 2 }),
}))

let mockListed: NormalizedTransaction[] = []
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ allTransactions: mockListed }),
}))

/** The SDK payment is stood in for by the transaction it maps to. */
jest.mock("@app/self-custodial/mappers/transaction", () => ({
  isKnownPayment: () => true,
  mapSelfCustodialTransaction: (payment: unknown) => payment,
}))

const NOW_S = Math.floor(Date.now() / 1000)

const lightningReceive = (id: string): NormalizedTransaction => ({
  id,
  amount: toWalletMoneyAmount(5_000, WalletCurrency.Btc),
  direction: TransactionDirection.Receive,
  status: TransactionStatus.Completed,
  timestamp: NOW_S,
  paymentType: PaymentType.Lightning,
  sourceAccountType: AccountType.SelfCustodial,
})

const deposit = (txid: string, extra: Partial<DepositInfo> = {}) =>
  ({ txid, vout: 0, amountSats: BigInt(5_000), isMature: false, ...extra }) as DepositInfo

describe("SelfCustodialSplashMount", () => {
  const showSplash = jest.fn(() => true)
  const showSplashes = jest.fn()
  const refresh = jest.fn()

  const mount = () => {
    const tree = () => (
      <IncomingTransactionSplashContext.Provider
        value={{ showSplash, showSplashes, refresh, isSplashShownForHash: () => false }}
      >
        <SelfCustodialSplashMount />
      </IncomingTransactionSplashContext.Provider>
    )
    const view = render(tree())
    return { rerender: () => view.rerender(tree()) }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockListed = []
  })

  it("hands a batch of deposits over together, so none is lost", () => {
    mount()

    act(() =>
      emitNewDeposits([
        deposit("a"),
        deposit("refunded", { refundTxId: "r" }),
        deposit("b"),
      ]),
    )

    expect(showSplashes).toHaveBeenCalledTimes(1)
    const [candidates] = showSplashes.mock.calls[0] as unknown as [
      Array<{ transaction: { id: string }; unclaimedDeposit: boolean }>,
    ]
    expect(candidates.map((candidate) => candidate.transaction.id)).toEqual([
      "a:0",
      "b:0",
    ])
    expect(candidates.every((candidate) => candidate.unclaimedDeposit)).toBe(true)
    expect(showSplash).not.toHaveBeenCalled()
  })

  it("shows a payment at once, with Details off until the wallet lists it", () => {
    const { rerender } = mount()
    const tx = lightningReceive("ln-1")

    act(() => emitSucceededPayment(tx as unknown as Payment))

    expect(showSplash).toHaveBeenCalledWith(
      expect.objectContaining({ detailsPending: true, unpriced: true }),
    )
    expect(refresh).not.toHaveBeenCalled()

    mockListed = [tx]
    rerender()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh.mock.calls[0]).toEqual([
      expect.objectContaining({ transaction: expect.objectContaining({ id: "ln-1" }) }),
    ])
    expect(refresh.mock.calls[0][0]).not.toHaveProperty("detailsPending", true)
  })

  it("leaves Details on for a payment the wallet already lists", () => {
    const tx = lightningReceive("ln-2")
    mockListed = [tx]
    mount()

    act(() => emitSucceededPayment(tx as unknown as Payment))

    expect(showSplash).toHaveBeenCalledWith(
      expect.objectContaining({ detailsPending: false }),
    )
  })

  it("marks a payment live only when the SDK reported it pending first", () => {
    mount()
    const live = lightningReceive("live")
    const replayed = lightningReceive("replayed")

    act(() => {
      notePendingPayment(live as unknown as Payment)
      emitSucceededPayment(live as unknown as Payment)
      emitSucceededPayment(replayed as unknown as Payment)
      emitSucceededPayment(live as unknown as Payment)
    })

    const flags = (
      showSplash.mock.calls as unknown as Array<[{ claimSeenLive: boolean }]>
    ).map(([candidate]) => candidate.claimSeenLive)
    expect(flags).toEqual([true, false, false])
  })

  it("offers neither a pending payment nor a claimed deposit", () => {
    mount()

    act(() => {
      emitSucceededPayment({
        ...lightningReceive("pending"),
        status: TransactionStatus.Pending,
      } as unknown as Payment)
      emitSucceededPayment({
        ...lightningReceive("claim"),
        paymentType: PaymentType.Onchain,
      } as unknown as Payment)
    })

    expect(showSplash).not.toHaveBeenCalled()
  })
})
