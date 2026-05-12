import { renderHook } from "@testing-library/react-native"

import { useOnchainFeeAlert } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-alert"
import { Network, WalletCurrency } from "@app/graphql/generated"
import type { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"

const mockGetOnChainTxFee = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useOnChainTxFeeLazyQuery: () => [mockGetOnChainTxFee],
}))

const buildOnchainPaymentDetail = (settlementSats = 100): PaymentDetail<WalletCurrency> =>
  ({
    paymentType: "onchain",
    settlementAmount: {
      amount: settlementSats,
      currency: WalletCurrency.Btc,
      currencyCode: "BTC",
    },
    convertMoneyAmount: (amt: { amount: number }) => ({
      amount: amt.amount,
      currency: WalletCurrency.Btc,
      currencyCode: "BTC",
    }),
  }) as unknown as PaymentDetail<WalletCurrency>

describe("useOnchainFeeAlert (Critical #6 — self-custodial gate)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetOnChainTxFee.mockResolvedValue({ data: { onChainTxFee: { amount: 5000 } } })
  })

  it("returns false and skips the GraphQL fetch when isSelfCustodial=true on onchain", async () => {
    const { result } = renderHook(() =>
      useOnchainFeeAlert({
        paymentDetail: buildOnchainPaymentDetail(100),
        walletId: "btc-wallet-1",
        network: Network.Mainnet,
        isSelfCustodial: true,
      }),
    )

    expect(result.current).toBe(false)
    // Effect runs synchronously in renderHook; if self-custodial gate works, fetcher never called.
    await Promise.resolve()
    expect(mockGetOnChainTxFee).not.toHaveBeenCalled()
  })

  it("fires the GraphQL fetch and returns true for high-fee custodial onchain", async () => {
    // settlement 100 sats; mocked fee 5000 sats; ratio 2x = 10000 → settlement < ratio fees → alert
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useOnchainFeeAlert>[0]) => useOnchainFeeAlert(props),
      {
        initialProps: {
          paymentDetail: buildOnchainPaymentDetail(100),
          walletId: "btc-wallet-1",
          network: Network.Mainnet,
          isSelfCustodial: false,
        },
      },
    )

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    rerender({
      paymentDetail: buildOnchainPaymentDetail(100),
      walletId: "btc-wallet-1",
      network: Network.Mainnet,
      isSelfCustodial: false,
    })

    expect(mockGetOnChainTxFee).toHaveBeenCalled()
    expect(result.current).toBe(true)
  })

  it("fires the GraphQL fetch but returns false for low-fee custodial onchain", async () => {
    // settlement 20000 sats; mocked fee 5000 sats; ratio 2x = 10000 → settlement > ratio fees → no alert
    const { result } = renderHook(() =>
      useOnchainFeeAlert({
        paymentDetail: buildOnchainPaymentDetail(20000),
        walletId: "btc-wallet-1",
        network: Network.Mainnet,
        isSelfCustodial: false,
      }),
    )

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    expect(mockGetOnChainTxFee).toHaveBeenCalled()
    expect(result.current).toBe(false)
  })

  it("returns false and skips the GraphQL fetch when paymentType is not onchain", async () => {
    const lightning = {
      ...buildOnchainPaymentDetail(100),
      paymentType: "lightning",
    } as unknown as PaymentDetail<WalletCurrency>

    const { result } = renderHook(() =>
      useOnchainFeeAlert({
        paymentDetail: lightning,
        walletId: "btc-wallet-1",
        network: Network.Mainnet,
        isSelfCustodial: false,
      }),
    )

    expect(result.current).toBe(false)
    await Promise.resolve()
    expect(mockGetOnChainTxFee).not.toHaveBeenCalled()
  })
})
