import { renderHook, act, waitFor } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"
import {
  applyPaymentRequestDefaults,
  btcAmount,
  mockSdk,
} from "../../helpers/self-custodial-payment-request"
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"
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
const mockLightningAddressGated = jest.fn()
const mockPendingDeposits = jest.fn()
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

jest.mock("@app/self-custodial/hooks/use-lightning-address-gate", () => ({
  useLightningAddressGated: () => mockLightningAddressGated(),
}))

// The real hook subscribes to navigation focus, which a bare renderHook has no
// container for; the receive screen it feeds is always inside one.
jest.mock("@app/self-custodial/hooks/use-pending-deposits", () => ({
  usePendingDeposits: () => mockPendingDeposits(),
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

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { id: "sc-account-1", type: "self-custodial" },
  }),
}))

jest.mock("@app/self-custodial/storage/onchain-address", () => ({
  ...jest.requireActual("@app/self-custodial/storage/onchain-address"),
  loadIssuedOnchainAddress: async () => null,
  saveIssuedOnchainAddress: async () => undefined,
}))

describe("usePaymentRequest invoice regeneration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    applyPaymentRequestDefaults({
      receiveLightning: mockReceiveLightning,
      receiveOnchain: mockReceiveOnchain,
      selfCustodialWallet: mockSelfCustodialWallet,
      activeWallet: mockActiveWallet,
      convertMoneyAmount: mockConvertMoneyAmount,
      addPendingAutoConvert: mockAddPendingAutoConvert,
      fetchAutoConvertMinSats: mockFetchAutoConvertMinSats,
      useReceiveAssetMode: mockUseReceiveAssetMode,
      lightningAddressGated: mockLightningAddressGated,
      pendingDeposits: mockPendingDeposits,
      formatMoneyAmount: mockFormatMoneyAmount,
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

  // Same race as above, but on the path where the in-flight call rejects: the pending edit
  // has to survive a failed attempt rather than only a successful one.
  it("applies a memo edit made while a failing generation is in flight", async () => {
    let rejectSecond: (err: Error) => void = () => {}
    mockReceiveLightning
      .mockImplementationOnce(() => Promise.reject(new Error("sdk down")))
      .mockImplementationOnce(
        () =>
          new Promise<{ invoice: string }>((_resolve, reject) => {
            rejectSecond = reject
          }),
      )
      .mockResolvedValue({ invoice: "lnbc1third..." })

    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Error")
    })

    setMemoTo(result, "din")
    await waitFor(() => {
      expect(mockReceiveLightning).toHaveBeenCalledTimes(2)
    })

    setMemoTo(result, "dinner")
    await act(async () => {
      rejectSecond(new Error("still down"))
    })

    await waitFor(() => {
      expect(mockReceiveLightning).toHaveBeenCalledTimes(3)
    })
    expect(mockReceiveLightning.mock.calls[2][0]).toEqual(
      expect.objectContaining({ memo: "dinner" }),
    )
  })

  it("regenerates the invoice when the asset mode is toggled", async () => {
    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })
    expect(mockAddPendingAutoConvert).not.toHaveBeenCalled()

    mockUseReceiveAssetMode.mockReturnValue({
      assetMode: "dollar",
      setAssetMode: jest.fn(),
      isToggleDisabled: false,
      loading: false,
    })
    mockReceiveLightning.mockResolvedValue({ invoice: "lnbc1dollar..." })
    rerender({})

    await waitFor(() => {
      expect(mockReceiveLightning).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(mockAddPendingAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  // The existing invoice is still the one the PayCode screen falls back to, so coming back
  // to an unchanged Lightning tab must not burn a second invoice.
  it("does not regenerate when the type leaves and returns to Lightning", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    act(() => {
      result.current?.setType(Invoice.PayCode)
    })
    await flushEffects()
    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)

    act(() => {
      result.current?.setType(Invoice.Lightning)
    })
    await flushEffects()
    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
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

  it("applies an amount edit made while a generation is in flight", async () => {
    let resolveFirst: (value: { invoice: string }) => void = () => {}
    mockReceiveLightning
      .mockImplementationOnce(
        () =>
          new Promise<{ invoice: string }>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValue({ invoice: "lnbc1withamount..." })

    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Loading")
    })

    act(() => {
      result.current?.setAmount(btcAmount(5000))
    })
    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst({ invoice: "lnbc1first..." })
    })

    await waitFor(() => {
      expect(mockReceiveLightning).toHaveBeenCalledTimes(2)
    })
    expect(mockReceiveLightning.mock.calls[1][0]?.amount?.amount).toBe(5000)
  })

  it("regenerates when the sdk instance is replaced", async () => {
    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    mockSelfCustodialWallet.mockReturnValue({
      sdk: { id: "reconnected-sdk" },
      lastReceivedPaymentId: null,
      allTransactions: [],
    })
    mockReceiveLightning.mockResolvedValue({ invoice: "lnbc1newsession..." })
    rerender({})

    await waitFor(() => {
      expect(mockReceiveLightning).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(result.current?.pr?.info?.data?.getCopyableInvoiceFn()).toBe(
        "lnbc1newsession...",
      )
    })
  })

  it("does not regenerate while an auto-convert is settling", async () => {
    mockUseReceiveAssetMode.mockReturnValue({
      assetMode: "dollar",
      setAssetMode: jest.fn(),
      isToggleDisabled: false,
      loading: false,
    })

    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: "payment-abc-123",
      allTransactions: [],
    })
    rerender({})
    await waitFor(() => {
      expect(result.current?.state).toBe("Converting")
    })

    setMemoTo(result, "too late")
    await flushEffects()

    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
    expect(result.current?.state).toBe("Converting")
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
      allTransactions: [],
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
