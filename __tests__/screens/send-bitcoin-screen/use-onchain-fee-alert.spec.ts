import { renderHook } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"
import { useOnchainFeeAlert } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-alert"
import { Network, PayoutSpeed, WalletCurrency } from "@app/graphql/generated"
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

describe("useOnchainFeeAlert (self-custodial gate)", () => {
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

    await flushEffects()
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

    await flushEffects()

    expect(mockGetOnChainTxFee).toHaveBeenCalled()
    expect(result.current).toBe(false)
  })

  it("probes the going rate for the payout speed the payment carries", async () => {
    const slowDetail = {
      ...buildOnchainPaymentDetail(100),
      payoutSpeed: PayoutSpeed.Slow,
    } as unknown as PaymentDetail<WalletCurrency>

    renderHook(() =>
      useOnchainFeeAlert({
        paymentDetail: slowDetail,
        walletId: "btc-wallet-1",
        network: Network.Mainnet,
        isSelfCustodial: false,
      }),
    )

    await flushEffects()

    expect(mockGetOnChainTxFee).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ speed: PayoutSpeed.Slow }),
      }),
    )
  })

  it("probes with a network-appropriate address", async () => {
    const probeAddressFor = async (network: Network) => {
      mockGetOnChainTxFee.mockClear()
      renderHook(() =>
        useOnchainFeeAlert({
          paymentDetail: buildOnchainPaymentDetail(100),
          walletId: "btc-wallet-1",
          network,
          isSelfCustodial: false,
        }),
      )
      await flushEffects()

      return mockGetOnChainTxFee.mock.calls[0][0].variables.address
    }

    // A mainnet bech32 probe against signet is rejected outright, so the fee never resolves.
    expect(await probeAddressFor(Network.Mainnet)).toMatch(/^bc1/)
    expect(await probeAddressFor(Network.Signet)).toMatch(/^tb1/)
  })

  it("falls back to the schema default speed when the payment carries none", async () => {
    renderHook(() =>
      useOnchainFeeAlert({
        paymentDetail: buildOnchainPaymentDetail(100),
        walletId: "btc-wallet-1",
        network: Network.Mainnet,
        isSelfCustodial: false,
      }),
    )

    await flushEffects()

    expect(mockGetOnChainTxFee).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ speed: PayoutSpeed.Fast }),
      }),
    )
  })

  it("ignores a slow probe once the user has already switched speed", async () => {
    let resolveStale: ((value: unknown) => void) | undefined
    // The Fast probe hangs, so the later Slow probe is the one that must win.
    mockGetOnChainTxFee.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve
        }),
    )
    mockGetOnChainTxFee.mockResolvedValue({ data: { onChainTxFee: { amount: 40 } } })

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useOnchainFeeAlert>[0]) => useOnchainFeeAlert(props),
      {
        initialProps: {
          paymentDetail: {
            ...buildOnchainPaymentDetail(100),
            payoutSpeed: PayoutSpeed.Fast,
          } as unknown as PaymentDetail<WalletCurrency>,
          walletId: "btc-wallet-1",
          network: Network.Mainnet,
          isSelfCustodial: false,
        },
      },
    )

    rerender({
      paymentDetail: {
        ...buildOnchainPaymentDetail(100),
        payoutSpeed: PayoutSpeed.Slow,
      } as unknown as PaymentDetail<WalletCurrency>,
      walletId: "btc-wallet-1",
      network: Network.Mainnet,
      isSelfCustodial: false,
    })
    await flushEffects()

    // 100 sats sent against the Slow rate of 40 clears the 2x threshold: no warning.
    expect(result.current).toBe(false)

    resolveStale?.({ data: { onChainTxFee: { amount: 5000 } } })
    await flushEffects()

    // The stale Fast rate would have crossed the threshold and warned.
    expect(result.current).toBe(false)
  })

  it("re-probes when the user switches payout speed", async () => {
    const { rerender } = renderHook(
      (props: Parameters<typeof useOnchainFeeAlert>[0]) => useOnchainFeeAlert(props),
      {
        initialProps: {
          paymentDetail: {
            ...buildOnchainPaymentDetail(100),
            payoutSpeed: PayoutSpeed.Fast,
          } as unknown as PaymentDetail<WalletCurrency>,
          walletId: "btc-wallet-1",
          network: Network.Mainnet,
          isSelfCustodial: false,
        },
      },
    )

    await flushEffects()
    mockGetOnChainTxFee.mockClear()

    rerender({
      paymentDetail: {
        ...buildOnchainPaymentDetail(100),
        payoutSpeed: PayoutSpeed.Slow,
      } as unknown as PaymentDetail<WalletCurrency>,
      walletId: "btc-wallet-1",
      network: Network.Mainnet,
      isSelfCustodial: false,
    })
    await flushEffects()

    expect(mockGetOnChainTxFee).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ speed: PayoutSpeed.Slow }),
      }),
    )
  })

  it("does not warn when the probe comes back without a fee", async () => {
    mockGetOnChainTxFee.mockResolvedValue({ data: undefined })

    const { result } = renderHook(() =>
      useOnchainFeeAlert({
        paymentDetail: buildOnchainPaymentDetail(100),
        walletId: "btc-wallet-1",
        network: Network.Mainnet,
        isSelfCustodial: false,
      }),
    )

    await flushEffects()

    expect(mockGetOnChainTxFee).toHaveBeenCalled()
    // With no rate to compare against there is nothing to call expensive.
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
