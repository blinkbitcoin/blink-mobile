import { renderHook, act, waitFor } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { usePaymentRequest } from "@app/self-custodial/hooks/use-payment-request"

import { flushEffects } from "../../helpers/flush-effects"
import {
  applyPaymentRequestDefaults,
  btcAmount,
  mockSdk,
} from "../../helpers/self-custodial-payment-request"

/**
 * The small setters and accessors the receive screen calls: memo commit, wallet
 * switching, and the on-chain URI builder — including the empty string it returns
 * before the address arrives.
 */

const mockReceiveLightning = jest.fn()
const mockReceiveOnchain = jest.fn()
const mockSelfCustodialWallet = jest.fn()
const mockActiveWallet = jest.fn()
const mockConvertMoneyAmount = jest.fn()
const mockAddPendingAutoConvert = jest.fn()
const mockFetchAutoConvertMinSats = jest.fn()
const mockUseReceiveAssetMode = jest.fn()
const mockLightningAddressGated = jest.fn()
const mockPendingDeposits = jest.fn()
const mockFormatMoneyAmount = jest.fn()
const mockSetAssetMode = jest.fn()
const mockAutoConvertStatus = jest.fn()
const mockRecordAppError = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  createReceiveLightning: () => mockReceiveLightning,
  createReceiveOnchain: () => mockReceiveOnchain,
}))

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: jest.fn(), log: jest.fn() }),
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

jest.mock("@app/utils/error-reporting", () => ({
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
}))

jest.mock("@app/self-custodial/providers/auto-convert-status", () => ({
  AutoConvertStatus: { Converting: "converting", Settled: "settled" },
  useAutoConvertStatus: () => mockAutoConvertStatus(),
}))

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
  mockAutoConvertStatus.mockReturnValue(undefined)
  mockUseReceiveAssetMode.mockReturnValue({
    assetMode: "bitcoin",
    setAssetMode: mockSetAssetMode,
    isToggleDisabled: false,
    loading: false,
  })
})

describe("setMemo", () => {
  it("commits the edited note", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    act(() => {
      result.current?.setMemoChangeText?.("dinner")
    })
    act(() => {
      result.current?.setMemo?.()
    })

    await waitFor(() => {
      expect(result.current?.memo).toBe("dinner")
    })
  })

  it("commits an empty note when the field was cleared", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    act(() => {
      result.current?.setMemoChangeText?.(null)
    })
    act(() => {
      result.current?.setMemo?.()
    })

    await waitFor(() => {
      expect(result.current?.memo).toBe("")
    })
  })
})

describe("switchReceivingWallet", () => {
  it("switches to Dollar mode for a USD wallet", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    act(() => {
      result.current?.switchReceivingWallet?.("Lightning", WalletCurrency.Usd)
    })

    expect(mockSetAssetMode).toHaveBeenCalledWith("dollar")
  })

  it("switches to Bitcoin mode for a BTC wallet", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    act(() => {
      result.current?.switchReceivingWallet?.("Lightning", WalletCurrency.Btc)
    })

    expect(mockSetAssetMode).toHaveBeenCalledWith("bitcoin")
  })
})

describe("on-chain URI accessor", () => {
  it("returns an empty on-chain URI until the address arrives", async () => {
    let resolveAddress: (value: { address: string }) => void = () => {}
    mockReceiveOnchain.mockReturnValue(
      new Promise<{ address: string }>((resolve) => {
        resolveAddress = resolve
      }),
    )

    const { result } = renderHook(() => usePaymentRequest())
    await flushEffects()

    expect(result.current?.getOnchainFullUriFn?.({})).toBe("")

    await act(async () => {
      resolveAddress({ address: "bc1qsettled" })
      await flushEffects()
    })

    expect(result.current?.getOnchainFullUriFn?.({ prefix: true })).toContain(
      "bc1qsettled",
    )
  })

  it("builds an on-chain URI carrying the amount and note", async () => {
    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qtest...")
    })

    act(() => {
      result.current?.setAmount?.(btcAmount(1500))
      result.current?.setMemoChangeText?.("rent")
    })
    act(() => {
      result.current?.setMemo?.()
    })

    await waitFor(() => {
      const uri = result.current?.getOnchainFullUriFn?.({}) ?? ""
      expect(uri).toContain("amount=")
      expect(uri).toContain("rent")
    })
  })
})

describe("Dollar-mode settlement", () => {
  const dollarMode = () => {
    mockUseReceiveAssetMode.mockReturnValue({
      assetMode: "dollar",
      setAssetMode: mockSetAssetMode,
      isToggleDisabled: false,
      loading: false,
    })
  }

  it("moves Converting to Paid once the auto-convert settles", async () => {
    dollarMode()
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: null,
      allTransactions: [],
    })

    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    // A Dollar invoice parks in Converting rather than Paid when payment lands.
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: "payment-1",
      allTransactions: [],
    })
    rerender({})
    await waitFor(() => {
      expect(result.current?.state).toBe("Converting")
    })

    mockAutoConvertStatus.mockReturnValue("settled")
    rerender({})

    await waitFor(() => {
      expect(result.current?.state).toBe("Paid")
    })
  })

  it("stays Converting while the auto-convert is still running", async () => {
    dollarMode()
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: null,
      allTransactions: [],
    })

    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })

    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: "payment-1",
      allTransactions: [],
    })
    rerender({})
    await waitFor(() => {
      expect(result.current?.state).toBe("Converting")
    })

    mockAutoConvertStatus.mockReturnValue("converting")
    rerender({})
    await flushEffects()

    expect(result.current?.state).toBe("Converting")
  })
})

describe("invoice generation failures", () => {
  it("describes a non-Error rejection from the lightning adapter", async () => {
    mockReceiveLightning.mockRejectedValue("string blowup")

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Error")
    })
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Self-custodial invoice generation failed: string blowup",
      }),
    )
  })
})
