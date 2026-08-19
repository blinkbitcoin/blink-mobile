import { renderHook, act, waitFor } from "@testing-library/react-native"

import {
  applyPaymentRequestDefaults,
  mockSdk,
} from "../../helpers/self-custodial-payment-request"
import { usePaymentRequest } from "@app/self-custodial/hooks/use-payment-request"

/**
 * The Lightning address as a receive method: when the screen opens on it, when it falls
 * back to an invoice, and when the address is withheld altogether.
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

describe("PayCode (lightning address QR by default) for self-custodial", () => {
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

  const setupWithLightningAddress = (lightningAddress: string) => {
    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: null,
      lightningAddress,
      allTransactions: [],
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

  /** The address is registered but withheld, so the screen must never open on it. The
   *  invoice takes its place: Incognito still receives, just not by address. */
  it("withholds the address as a receive method in Incognito", async () => {
    setupWithLightningAddress("alice@spark.tips")
    mockLightningAddressGated.mockReturnValue(true)

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })
    expect(result.current?.canUsePaycode).toBe(false)
    expect(result.current?.type).toBe("Lightning")
    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
  })

  /** Nothing regenerates a PayCode, so a type left parked there would keep an
   *  unpayable address on screen for the rest of the session. */
  it("gives up the PayCode type when the address is withheld mid-session", async () => {
    setupWithLightningAddress("alice@spark.tips")

    const { result, rerender } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.type).toBe("PayCode")
    })

    mockLightningAddressGated.mockReturnValue(true)
    rerender({})

    await waitFor(() => {
      expect(result.current?.state).toBe("Created")
    })
    expect(result.current?.type).toBe("Lightning")
    expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
  })

  /** The provider clears the address on every account switch and re-resolves it, so a
   *  missing address is not a withheld one: giving up PayCode here would leave the
   *  screen on invoices for the rest of the session once the address came back. */
  it("keeps the PayCode type while the address is merely still resolving", async () => {
    setupWithLightningAddress("alice@spark.tips")

    const { result, rerender } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.type).toBe("PayCode")
    })

    mockSelfCustodialWallet.mockReturnValue({
      sdk: mockSdk,
      lastReceivedPaymentId: null,
      lightningAddress: null,
      allTransactions: [],
    })
    rerender({})

    expect(result.current?.canUsePaycode).toBe(false)
    expect(result.current?.type).toBe("PayCode")
    expect(mockReceiveLightning).not.toHaveBeenCalled()
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
