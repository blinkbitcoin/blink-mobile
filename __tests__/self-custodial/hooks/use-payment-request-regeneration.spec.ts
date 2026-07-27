import { renderHook, act, waitFor } from "@testing-library/react-native"
import { WalletCurrency } from "@app/graphql/generated"

import { flushEffects } from "../../helpers/flush-effects"
import { usePaymentRequest } from "@app/self-custodial/hooks/use-payment-request"

const mockReceiveLightning = jest.fn()
const mockReceiveOnchain = jest.fn()
const mockSelfCustodialWallet = jest.fn()
const mockActiveWallet = jest.fn()
const mockConvertMoneyAmount = jest.fn()
const mockRecordError = jest.fn()
const mockAddPendingAutoConvert = jest.fn()
const mockFetchAutoConvertMinSats = jest.fn()
const mockUseReceiveAssetMode = jest.fn()
const mockFormatMoneyAmount = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  createReceiveLightning: () => mockReceiveLightning,
  createReceiveOnchain: () => mockReceiveOnchain,
}))

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError, log: jest.fn() }),
}))

jest.mock("@app/self-custodial/auto-convert", () => ({
  addPendingAutoConvert: (...args: unknown[]) => mockAddPendingAutoConvert(...args),
  fetchAutoConvertMinSats: (...args: unknown[]) => mockFetchAutoConvertMinSats(...args),
  ReceiveAssetMode: { Bitcoin: "bitcoin", Dollar: "dollar" },
}))

jest.mock("@app/self-custodial/hooks/use-receive-asset-mode", () => ({
  useReceiveAssetMode: () => mockUseReceiveAssetMode(),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet(),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

const btcWallet = {
  id: "btc-w1",
  walletCurrency: WalletCurrency.Btc,
  balance: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  transactions: [],
}

const usdWallet = {
  id: "usd-w1",
  walletCurrency: WalletCurrency.Usd,
  balance: { amount: 500, currency: WalletCurrency.Usd, currencyCode: "USD" },
  transactions: [],
}

const mockSdk = { id: "mock-sdk" }

const btcAmount = (amount: number) => ({
  amount,
  currency: WalletCurrency.Btc,
  currencyCode: "BTC",
})

describe("usePaymentRequest invoice regeneration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: null,
    })
    mockActiveWallet.mockReturnValue({ wallets: [btcWallet, usdWallet], isReady: true })
    mockReceiveLightning.mockResolvedValue({ invoice: "lnbc1test..." })
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qtest..." })
    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: string) => ({
        amount: amount.amount,
        currency,
        currencyCode: currency,
      }),
    )
    mockFormatMoneyAmount.mockImplementation(
      ({ moneyAmount }: { moneyAmount: { amount: number } }) => `$${moneyAmount.amount}`,
    )
    mockAddPendingAutoConvert.mockResolvedValue(undefined)
    mockFetchAutoConvertMinSats.mockResolvedValue(undefined)
    mockUseReceiveAssetMode.mockReturnValue({
      assetMode: "bitcoin",
      setAssetMode: jest.fn(),
      isToggleDisabled: false,
      loading: false,
    })
  })

  /** Mirrors the screen: type into the note field, then blur it. */
  const setMemoTo = (
    result: { current: ReturnType<typeof usePaymentRequest> },
    memo: string,
  ) => {
    act(() => {
      result.current?.setMemoChangeText(memo)
    })
    act(() => {
      result.current?.setMemo()
    })
  }

  it("regenerates the invoice with the new memo", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })
    mockReceiveLightning.mockResolvedValue({ invoice: "lnbc1withmemo..." })

    setMemoTo(result, "dinner")

    await waitFor(() => {
      expect(mockReceiveLightning).toHaveBeenCalledTimes(2)
    })
    expect(mockReceiveLightning.mock.calls[1][0]).toEqual(
      expect.objectContaining({ memo: "dinner" }),
    )
    await waitFor(() => {
      expect(result.current?.pr?.info?.data?.getCopyableInvoiceFn()).toBe(
        "lnbc1withmemo...",
      )
    })
  })

  it("applies a memo edit made while a generation is in flight", async () => {
    let resolveFirst: (value: { invoice: string }) => void = () => {}
    mockReceiveLightning
      .mockImplementationOnce(
        () =>
          new Promise<{ invoice: string }>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValue({ invoice: "lnbc1second..." })

    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Loading")
    })

    setMemoTo(result, "dinner")
    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst({ invoice: "lnbc1first..." })
    })

    await waitFor(() => {
      expect(mockReceiveLightning).toHaveBeenCalledTimes(2)
    })
    expect(mockReceiveLightning.mock.calls[1][0]).toEqual(
      expect.objectContaining({ memo: "dinner" }),
    )
    await waitFor(() => {
      expect(result.current?.pr?.info?.data?.getCopyableInvoiceFn()).toBe(
        "lnbc1second...",
      )
    })
  })

  it("regenerates the invoice when the amount changes", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    act(() => {
      result.current?.setAmount(btcAmount(5000))
    })

    await waitFor(() => {
      expect(mockReceiveLightning).toHaveBeenCalledTimes(2)
    })
    expect(mockReceiveLightning.mock.calls[1][0]?.amount?.amount).toBe(5000)
  })

  it("does not regenerate when nothing changed", async () => {
    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    rerender({})
    await flushEffects()

    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
  })

  it("does not regenerate once the invoice is paid", async () => {
    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: "payment-abc-123",
    })
    rerender({})
    await waitFor(() => {
      expect(result.current?.state).toBe("Paid")
    })

    setMemoTo(result, "too late")
    await flushEffects()

    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
    expect(result.current?.state).toBe("Paid")
  })

  it("does not retry in a loop when generation fails", async () => {
    mockReceiveLightning.mockRejectedValue(new Error("sdk down"))

    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Error")
    })
    await flushEffects()

    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
  })

  it("regenerateInvoice re-runs generation even when nothing changed", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    await act(async () => {
      await result.current?.regenerateInvoice()
    })

    expect(mockReceiveLightning).toHaveBeenCalledTimes(2)
  })
})
