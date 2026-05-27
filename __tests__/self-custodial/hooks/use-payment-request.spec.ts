import { renderHook, act, waitFor } from "@testing-library/react-native"
import { WalletCurrency } from "@app/graphql/generated"

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

jest.mock("@app/hooks/use-payments", () => {
  const stableReceiveLightning = (...args: unknown[]) =>
    (
      globalThis as unknown as { __mockReceiveLightning: jest.Mock }
    ).__mockReceiveLightning(...args)
  const stableReceiveOnchain = (...args: unknown[]) =>
    (globalThis as unknown as { __mockReceiveOnchain: jest.Mock }).__mockReceiveOnchain(
      ...args,
    )
  const stablePaymentsResult = {
    receiveLightning: stableReceiveLightning,
    receiveOnchain: stableReceiveOnchain,
  }
  return { usePayments: () => stablePaymentsResult }
})
;(globalThis as unknown as { __mockReceiveLightning: jest.Mock }).__mockReceiveLightning =
  mockReceiveLightning
;(globalThis as unknown as { __mockReceiveOnchain: jest.Mock }).__mockReceiveOnchain =
  mockReceiveOnchain

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

describe("usePaymentRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: null,
    })
    mockActiveWallet.mockReturnValue({ wallets: [btcWallet, usdWallet], isReady: true })
    mockReceiveLightning.mockResolvedValue({
      invoice: { paymentRequest: "lnbc1test..." },
    })
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qtest..." })
    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: string) => ({
        amount: amount.amount,
        currency,
        currencyCode: currency,
      }),
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

  it("returns null when sdk is unavailable", () => {
    mockSelfCustodialWallet.mockReturnValue({
      sdk: undefined,
      lastReceivedPaymentId: null,
    })

    const { result } = renderHook(() => usePaymentRequest())

    expect(result.current).toBeNull()
  })

  it("returns null when btcWallet is missing", () => {
    mockActiveWallet.mockReturnValue({ wallets: [] })

    const { result } = renderHook(() => usePaymentRequest())

    expect(result.current).toBeNull()
  })

  it("generates Lightning invoice on mount", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
  })

  it("returns wallet IDs", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    expect(result.current?.btcWalletId).toBe("btc-w1")
    expect(result.current?.usdWalletId).toBe("usd-w1")
  })

  it("sets error state when receive fails", async () => {
    mockReceiveLightning.mockResolvedValue({ errors: [{ message: "fail" }] })

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Error")
    })
  })

  it("sets error state when the adapter returns no invoice", async () => {
    mockReceiveLightning.mockResolvedValue({ errors: [{ message: "network down" }] })

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Error")
    })
  })

  it("sets error state when the adapter resolves with an empty object", async () => {
    mockReceiveLightning.mockResolvedValue({} as unknown as { invoice: string })

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Error")
    })
  })

  it("does not call the receive adapter while active wallet is not ready", () => {
    mockActiveWallet.mockReturnValue({
      wallets: [btcWallet, usdWallet],
      isReady: false,
    })

    renderHook(() => usePaymentRequest())

    expect(mockReceiveLightning).not.toHaveBeenCalled()
  })

  it("getFullUriFn returns raw lightning invoice without `lightning:` prefix even when prefix is requested", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    const uri = result.current?.paymentRequest?.info?.data?.getFullUriFn({
      prefix: true,
      uppercase: false,
    })
    expect(uri).toBe("lnbc1test...")
  })

  it("getFullUriFn returns raw invoice without prefix", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    const uri = result.current?.paymentRequest?.info?.data?.getFullUriFn({
      prefix: false,
      uppercase: false,
    })
    expect(uri).toBe("lnbc1test...")
  })

  it("getFullUriFn returns uppercased invoice when requested", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    const uri = result.current?.paymentRequest?.info?.data?.getFullUriFn({
      uppercase: true,
    })
    expect(uri).toBe("LNBC1TEST...")
  })

  it("getCopyableInvoiceFn returns payment request", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    const invoice = result.current?.paymentRequest?.info?.data?.getCopyableInvoiceFn()
    expect(invoice).toBe("lnbc1test...")
  })

  it("setMemo updates memo from memoChangeText", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    act(() => {
      result.current?.setMemoChangeText("test memo")
    })

    act(() => {
      result.current?.setMemo()
    })

    expect(result.current?.memo).toBe("test memo")
  })

  it("setAmount updates unitOfAccountAmount", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    act(() => {
      result.current?.setAmount({
        amount: 5000,
        currency: WalletCurrency.Btc,
        currencyCode: "BTC",
      })
    })

    expect(result.current?.unitOfAccountAmount?.amount).toBe(5000)
  })

  it("transitions to Paid when a new payment arrives after invoice creation", async () => {
    const { result, rerender } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })
    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)

    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: "payment-abc-123",
    })
    rerender({})

    await waitFor(() => {
      expect(result.current?.state).toBe("Paid")
    })
  })

  it("does not trigger Paid on re-entry when payment ID matches baseline", async () => {
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: "payment-already-seen",
    })

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    expect(result.current?.state).toBe("Created")
  })

  it("full cycle: create → paid → re-enter → new invoice without re-triggering", async () => {
    const { result, rerender, unmount } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: "payment-first",
    })
    rerender({})

    await waitFor(() => {
      expect(result.current?.state).toBe("Paid")
    })

    unmount()

    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: "payment-first",
    })
    mockReceiveLightning.mockResolvedValue({
      invoice: { paymentRequest: "lnbc1second..." },
    })

    const { result: result2 } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result2.current?.state).toBe("Created")
    })

    expect(result2.current?.state).toBe("Created")
  })

  it("has correct self-custodial-specific defaults", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    expect(result.current?.canSetAmount).toBe(true)
    expect(result.current?.canSetMemo).toBe(true)
    expect(result.current?.canUsePaycode).toBe(false)
    expect(result.current?.canSetExpirationTime).toBe(false)
    expect(result.current?.feesInformation).toBeUndefined()
    expect(result.current?.lnAddressHostname).toBe("")
  })

  describe("Dollar-mode auto-convert integration", () => {
    it("persists a pending auto-convert record when the invoice is flagged Dollar", async () => {
      mockUseReceiveAssetMode.mockReturnValue({
        assetMode: "dollar",
        setAssetMode: jest.fn(),
        isToggleDisabled: false,
      })
      mockReceiveLightning.mockResolvedValue({
        invoice: { paymentRequest: "lnbc1dollar..." },
      })

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.state).toBe("Created")
      })

      expect(mockAddPendingAutoConvert).toHaveBeenCalledTimes(1)
      const record = mockAddPendingAutoConvert.mock.calls[0][0]
      expect(record.paymentRequest).toBe("lnbc1dollar...")
      expect(record.attempts).toBe(0)
      expect(record.lastAttemptAtMs).toBeUndefined()
      expect(typeof record.createdAtMs).toBe("number")
    })

    it("does NOT create a pending auto-convert record when invoice is in Bitcoin mode", async () => {
      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.state).toBe("Created")
      })

      expect(mockAddPendingAutoConvert).not.toHaveBeenCalled()
    })
  })

  describe("auto-convert minimum warning flags", () => {
    it("exposes shouldShowAutoConvertMinWarning=true when amount is below the pool minimum", async () => {
      mockUseReceiveAssetMode.mockReturnValue({
        assetMode: "dollar",
        setAssetMode: jest.fn(),
        isToggleDisabled: false,
      })
      mockFetchAutoConvertMinSats.mockResolvedValue(1000)

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.autoConvertMinSats).toBe(1000)
      })

      act(() => {
        result.current?.setAmount({
          amount: 500,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        })
      })

      await waitFor(() => {
        expect(result.current?.shouldShowAutoConvertMinWarning).toBe(true)
      })
    })

    it("exposes shouldShowAutoConvertMinWarning=false in Bitcoin mode", async () => {
      mockFetchAutoConvertMinSats.mockResolvedValue(1000)

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.autoConvertMinSats).toBe(1000)
      })

      expect(result.current?.shouldShowAutoConvertMinWarning).toBe(false)
    })
  })

  describe("asset toggle state from useReceiveAssetMode", () => {
    it("surfaces the toggle-disabled state", async () => {
      mockUseReceiveAssetMode.mockReturnValue({
        assetMode: "dollar",
        setAssetMode: jest.fn(),
        isToggleDisabled: true,
        loading: false,
      })

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.state).toBe("Created")
      })

      expect(result.current?.isAssetToggleDisabled).toBe(true)
    })
  })

  describe("defers invoice generation while settings are loading", () => {
    it("does not call the receive adapter while useReceiveAssetMode reports loading", async () => {
      mockUseReceiveAssetMode.mockReturnValue({
        assetMode: "bitcoin",
        setAssetMode: jest.fn(),
        isToggleDisabled: false,
        loading: true,
      })

      renderHook(() => usePaymentRequest())

      // Give any pending microtasks a chance to flush.
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })

      expect(mockReceiveLightning).not.toHaveBeenCalled()
      expect(mockAddPendingAutoConvert).not.toHaveBeenCalled()
    })

    it("generates the invoice once loading flips to false", async () => {
      mockUseReceiveAssetMode.mockReturnValue({
        assetMode: "dollar",
        setAssetMode: jest.fn(),
        isToggleDisabled: true,
        loading: true,
      })

      const { rerender } = renderHook(() => usePaymentRequest())

      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
      expect(mockReceiveLightning).not.toHaveBeenCalled()
      expect(mockAddPendingAutoConvert).not.toHaveBeenCalled()

      mockUseReceiveAssetMode.mockReturnValue({
        assetMode: "dollar",
        setAssetMode: jest.fn(),
        isToggleDisabled: true,
        loading: false,
      })
      rerender({})

      await waitFor(() => {
        expect(mockReceiveLightning).toHaveBeenCalled()
      })
      expect(mockAddPendingAutoConvert).toHaveBeenCalled()
    })
  })

  describe("PayCode (lightning address QR by default) for self-custodial", () => {
    const setupWithLightningAddress = (lightningAddress: string) => {
      mockSelfCustodialWallet.mockReturnValue({
        sdk: mockSdk,
        lastReceivedPaymentId: null,
        lightningAddress,
      })
    }

    it("opens with PayCode type when LN address is available and asset mode is Bitcoin", async () => {
      setupWithLightningAddress("alice@spark.tips")

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.type).toBe("PayCode")
      })
      expect(mockReceiveLightning).not.toHaveBeenCalled()
      expect(result.current?.state).toBe("Idle")
    })

    it("stays on Lightning when LN address is available but asset mode is Dollar", async () => {
      setupWithLightningAddress("alice@spark.tips")
      mockUseReceiveAssetMode.mockReturnValue({
        assetMode: "dollar",
        setAssetMode: jest.fn(),
        isToggleDisabled: false,
        loading: false,
      })

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.state).toBe("Created")
      })
      expect(result.current?.type).toBe("Lightning")
      expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
    })

    it("surfaces canUsePaycode and lnAddressHostname when LN address is available", async () => {
      setupWithLightningAddress("alice@spark.tips")

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.canUsePaycode).toBe(true)
      })
      expect(result.current?.lnAddressHostname).toBe("spark.tips")
    })

    it("returns canUsePaycode=false and empty lnAddressHostname when no LN address", async () => {
      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.state).toBe("Created")
      })
      expect(result.current?.canUsePaycode).toBe(false)
      expect(result.current?.lnAddressHostname).toBe("")
    })

    it("info.data carries PayCode shape with username when on PayCode", async () => {
      setupWithLightningAddress("alice@spark.tips")

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.type).toBe("PayCode")
      })
      const data = result.current?.info?.data
      expect(data?.invoiceType).toBe("PayCode")
      expect(data?.username).toBe("alice")
      expect(data?.getFullUriFn({ uppercase: false })).toBe("alice@spark.tips")
      expect(data?.getFullUriFn({ uppercase: true })).toBe("ALICE@SPARK.TIPS")
      expect(data?.getCopyableInvoiceFn()).toBe("alice@spark.tips")
    })

    it("switches to Lightning and generates an invoice when setType(Lightning) is called", async () => {
      setupWithLightningAddress("alice@spark.tips")

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.type).toBe("PayCode")
      })
      expect(mockReceiveLightning).not.toHaveBeenCalled()

      act(() => {
        result.current?.setType("Lightning")
      })

      await waitFor(() => {
        expect(result.current?.state).toBe("Created")
      })
      expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
      expect(result.current?.info?.data?.invoiceType).toBe("Lightning")
    })
  })
})
