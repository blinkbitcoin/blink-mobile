import { renderHook, act, waitFor } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"
import {
  applyPaymentRequestDefaults,
  mockSdk,
  onchainReceipt,
} from "../../helpers/self-custodial-payment-request"
import { usePaymentRequest } from "@app/self-custodial/hooks/use-payment-request"

/**
 * The on-chain deposit address must not be reused once it has been paid.
 * The Spark SDK never reports which address a deposit landed on, so the hook infers
 * reuse from the wallet's on-chain receive history — that inference is what these
 * specs pin down. Regression coverage for #4113.
 */

const mockReceiveLightning = jest.fn()
const mockReceiveOnchain = jest.fn()
const mockSelfCustodialWallet = jest.fn()
const mockActiveWallet = jest.fn()
const mockConvertMoneyAmount = jest.fn()
const mockAddPendingAutoConvert = jest.fn()
const mockFetchAutoConvertMinSats = jest.fn()
const mockUseReceiveAssetMode = jest.fn()
const mockFormatMoneyAmount = jest.fn()
const mockLoadIssuedOnchainAddress = jest.fn()
const mockSaveIssuedOnchainAddress = jest.fn()

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
  loadIssuedOnchainAddress: (...args: unknown[]) => mockLoadIssuedOnchainAddress(...args),
  saveIssuedOnchainAddress: (...args: unknown[]) => mockSaveIssuedOnchainAddress(...args),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockLoadIssuedOnchainAddress.mockResolvedValue(null)
  mockSaveIssuedOnchainAddress.mockResolvedValue(undefined)
  applyPaymentRequestDefaults({
    receiveLightning: mockReceiveLightning,
    receiveOnchain: mockReceiveOnchain,
    selfCustodialWallet: mockSelfCustodialWallet,
    activeWallet: mockActiveWallet,
    convertMoneyAmount: mockConvertMoneyAmount,
    addPendingAutoConvert: mockAddPendingAutoConvert,
    fetchAutoConvertMinSats: mockFetchAutoConvertMinSats,
    useReceiveAssetMode: mockUseReceiveAssetMode,
    formatMoneyAmount: mockFormatMoneyAmount,
  })
})

describe("onchain address rotation", () => {
  const walletWith = (transactions: unknown[]) => ({
    sdk: mockSdk,
    lastReceivedPaymentId: null,
    allTransactions: transactions,
  })

  it("reuses the stored address while no on-chain deposit has arrived", async () => {
    mockLoadIssuedOnchainAddress.mockResolvedValue({
      address: "bc1qfirst...",
      depositMarker: null,
    })

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qtest...")
    })
    expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
  })

  it("rotates once an on-chain deposit lands while the screen is open", async () => {
    mockLoadIssuedOnchainAddress.mockResolvedValue({
      address: "bc1qfirst...",
      depositMarker: null,
    })
    mockReceiveOnchain
      .mockResolvedValueOnce({ address: "bc1qfirst..." })
      .mockResolvedValueOnce({ address: "bc1qrotated..." })

    const { result, rerender } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qfirst...")
    })

    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
    rerender({})

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qrotated...")
    })
    expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: true })
    expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
      address: "bc1qrotated...",
      depositMarker: "deposit-1",
    })
  })

  it("rotates on mount when the deposit landed while the app was closed", async () => {
    // The reported scenario: money arrived, the app was reopened, and the stored
    // record still points at the marker from before that deposit.
    mockLoadIssuedOnchainAddress.mockResolvedValue({
      address: "bc1qused...",
      depositMarker: null,
    })
    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qrotated..." })

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qrotated...")
    })
    expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: true })
  })

  it("does not rotate for a lightning receipt", async () => {
    mockLoadIssuedOnchainAddress.mockResolvedValue({
      address: "bc1qfirst...",
      depositMarker: null,
    })

    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qtest...")
    })

    mockSelfCustodialWallet.mockReturnValue(
      walletWith([{ ...onchainReceipt("ln-1"), paymentType: "lightning" }]),
    )
    rerender({})
    await flushEffects()

    expect(mockReceiveOnchain).not.toHaveBeenCalledWith({ newAddress: true })
  })

  it("adopts the SDK's existing address for a wallet with no stored record", async () => {
    mockLoadIssuedOnchainAddress.mockResolvedValue(null)
    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qtest...")
    })
    expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
    expect(mockSaveIssuedOnchainAddress).toHaveBeenCalledWith("sc-account-1", {
      address: "bc1qtest...",
      depositMarker: "deposit-1",
    })
  })

  it("rotates on demand when the manual action is invoked", async () => {
    mockReceiveOnchain
      .mockResolvedValueOnce({ address: "bc1qfirst..." })
      .mockResolvedValueOnce({ address: "bc1qmanual..." })

    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qfirst...")
    })

    await act(async () => {
      result.current?.rotateOnchainAddress?.()
      await flushEffects()
    })

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qmanual...")
    })
    expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: true })
    // A forced rotation never consults the stored record.
    expect(mockLoadIssuedOnchainAddress).toHaveBeenCalledTimes(1)
  })

  it("keeps the address when a rotation request returns nothing", async () => {
    mockReceiveOnchain
      .mockResolvedValueOnce({ address: "bc1qfirst..." })
      .mockResolvedValueOnce({ errors: [{ message: "sdk offline" }] })

    const { result } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qfirst...")
    })

    await act(async () => {
      result.current?.rotateOnchainAddress?.()
      await flushEffects()
    })

    expect(result.current?.onchainAddress).toBe("bc1qfirst...")
  })
})
