import { renderHook, act, waitFor } from "@testing-library/react-native"
import { WalletCurrency } from "@app/graphql/generated"

import { usePaymentRequest } from "@app/self-custodial/hooks/use-payment-request"

const mockReceiveLightning = jest.fn()
const mockReceiveOnchain = jest.fn()
const mockSelfCustodialWallet = jest.fn()
const mockActiveWallet = jest.fn()
const mockConvertMoneyAmount = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  createReceiveLightning: () => mockReceiveLightning,
  createReceiveOnchain: () => mockReceiveOnchain,
}))

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError, log: jest.fn() }),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
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
    mockReceiveLightning.mockResolvedValue({ invoice: "lnbc1test..." })
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qtest..." })
    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: string) => ({
        amount: amount.amount,
        currency,
        currencyCode: currency,
      }),
    )
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

  it("sets error state when the receive adapter throws", async () => {
    mockReceiveLightning.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Error")
    })
  })

  it("records the rejection to crashlytics when the receive adapter throws (Important #4)", async () => {
    mockReceiveLightning.mockRejectedValue(new Error("invoice generation boom"))

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Error")
    })

    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "invoice generation boom" }),
    )
  })

  it("does not call the receive adapter while active wallet is not ready", () => {
    mockActiveWallet.mockReturnValue({
      wallets: [btcWallet, usdWallet],
      isReady: false,
    })

    renderHook(() => usePaymentRequest())

    expect(mockReceiveLightning).not.toHaveBeenCalled()
  })

  it("generates on-chain address on mount", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qtest...")
    })
  })

  it("getFullUriFn returns raw lightning invoice without `lightning:` prefix even when prefix is requested", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    const uri = result.current?.pr?.info?.data?.getFullUriFn({
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

    const uri = result.current?.pr?.info?.data?.getFullUriFn({
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

    const uri = result.current?.pr?.info?.data?.getFullUriFn({ uppercase: true })
    expect(uri).toBe("LNBC1TEST...")
  })

  it("getCopyableInvoiceFn returns payment request", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    const invoice = result.current?.pr?.info?.data?.getCopyableInvoiceFn()
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
    mockReceiveLightning.mockResolvedValue({ invoice: "lnbc1second..." })

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

  it("getOnchainFullUriFn returns bitcoin URI with address", async () => {
    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qtest...")
    })

    const uri = result.current?.getOnchainFullUriFn?.({
      prefix: true,
      uppercase: false,
    })
    expect(uri).toBe("bitcoin:bc1qtest...")
  })

  describe("onchain adapter rejection (regression I7)", () => {
    it("does not crash the hook when createReceiveOnchain rejects", async () => {
      mockReceiveOnchain.mockRejectedValueOnce(new Error("onchain receive boom"))
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current).not.toBeNull()
      })
      expect(result.current?.onchainAddress).toBeUndefined()
      consoleSpy.mockRestore()
    })

    it("does not surface an unhandled rejection when the SDK adapter throws", async () => {
      const onUnhandled = jest.fn()
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      process.on("unhandledRejection", onUnhandled)

      mockReceiveOnchain.mockRejectedValueOnce(new Error("onchain rejected"))
      renderHook(() => usePaymentRequest())
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
      process.off("unhandledRejection", onUnhandled)
      consoleSpy.mockRestore()

      expect(onUnhandled).not.toHaveBeenCalled()
    })

    it("retries the onchain address when the SDK identity changes (reconnect)", async () => {
      mockReceiveOnchain
        .mockResolvedValueOnce({ address: "bc1qfirst..." })
        .mockResolvedValueOnce({ address: "bc1qsecond..." })

      const { result, rerender } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qfirst...")
      })

      // Simulate SDK reconnect: provider hands back a new sdk identity.
      mockSelfCustodialWallet.mockReturnValue({
        sdk: { id: "different-sdk" },
        lastReceivedPaymentId: null,
      })

      rerender({})

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qsecond...")
      })
    })
  })
})
