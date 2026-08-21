import { renderHook, act, waitFor } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"
import {
  applyPaymentRequestDefaults,
  mockSdk,
  onchainReceipt,
  pendingDeposit,
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
const mockLightningAddressGated = jest.fn()
const mockPendingDeposits = jest.fn()
const mockFormatMoneyAmount = jest.fn()
const mockAccountRegistry = jest.fn()
const mockRecordAppError = jest.fn()
const mockLoadIssuedOnchainAddress = jest.fn()
const mockSaveIssuedOnchainAddress = jest.fn()
const mockFindLatestOnchainReceiptId = jest.fn()

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

// The lookback the hook falls through to when the loaded history holds no on-chain
// receipt; its own paging is covered in the wallet-snapshot spec.
jest.mock("@app/self-custodial/providers/wallet-snapshot", () => ({
  findLatestOnchainReceiptId: (...args: unknown[]) =>
    mockFindLatestOnchainReceiptId(...args),
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
  useAccountRegistry: () => mockAccountRegistry(),
}))

jest.mock("@app/utils/error-reporting", () => ({
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
}))

jest.mock("@app/self-custodial/storage/onchain-address", () => ({
  ...jest.requireActual("@app/self-custodial/storage/onchain-address"),
  loadIssuedOnchainAddress: (...args: unknown[]) => mockLoadIssuedOnchainAddress(...args),
  saveIssuedOnchainAddress: (...args: unknown[]) => mockSaveIssuedOnchainAddress(...args),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockAccountRegistry.mockReturnValue({
    activeAccount: { id: "sc-account-1", type: "self-custodial" },
  })
  mockLoadIssuedOnchainAddress.mockResolvedValue(null)
  mockSaveIssuedOnchainAddress.mockResolvedValue(undefined)
  mockFindLatestOnchainReceiptId.mockResolvedValue(null)
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
      seenPendingDepositIds: [],
    })
  })

  it("waits for the wallet snapshot instead of reading an empty history as no deposits", async () => {
    // Mounting during a cold start, a reconnect or a failed refresh: the snapshot has
    // not landed, so `allTransactions` is empty. Rotating here would burn an address on
    // every offline visit, and writing the empty marker back would make the deposit
    // look new all over again once the snapshot arrives.
    mockLoadIssuedOnchainAddress.mockResolvedValue({
      address: "bc1qstored...",
      depositMarker: "deposit-1",
    })

    const { result, rerender } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qtest...")
    })
    expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
    expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
      address: "bc1qtest...",
      depositMarker: "deposit-1",
      seenPendingDepositIds: [],
    })

    // The snapshot lands and confirms the marker we already held: still nothing new.
    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
    rerender({})
    await flushEffects()

    expect(mockReceiveOnchain).not.toHaveBeenCalledWith({ newAddress: true })
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

  it("rotates once for a wallet with receipts but no stored record", async () => {
    // The first run after upgrading: nothing was ever recorded, yet the wallet has
    // already been paid on-chain — so the address the SDK is holding may well be the
    // one that was used. Rotating once costs an address; adopting it costs privacy.
    mockLoadIssuedOnchainAddress.mockResolvedValue(null)
    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qrotated..." })

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qrotated...")
    })
    expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: true })
    expect(mockSaveIssuedOnchainAddress).toHaveBeenCalledWith("sc-account-1", {
      address: "bc1qrotated...",
      depositMarker: "deposit-1",
      seenPendingDepositIds: [],
    })
  })

  it("adopts the SDK's existing address for a wallet that has never been paid", async () => {
    mockLoadIssuedOnchainAddress.mockResolvedValue(null)

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qtest...")
    })
    expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
    expect(mockSaveIssuedOnchainAddress).toHaveBeenCalledWith("sc-account-1", {
      address: "bc1qtest...",
      depositMarker: null,
      seenPendingDepositIds: [],
    })
  })

  it("keeps the address and reports the failure when a rotation returns nothing", async () => {
    // The adapter reports failures as an error-only result rather than throwing, so
    // without an explicit report the rotation would fail in complete silence — and
    // the address already on screen has to survive it.
    mockLoadIssuedOnchainAddress.mockResolvedValue({
      address: "bc1qfirst...",
      depositMarker: null,
    })
    mockReceiveOnchain
      .mockResolvedValueOnce({ address: "bc1qfirst..." })
      .mockResolvedValueOnce({ errors: [{ message: "sdk offline" }] })

    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qfirst...")
    })

    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
    rerender({})
    await flushEffects()

    expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: true })
    expect(result.current?.onchainAddress).toBe("bc1qfirst...")
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("sdk offline"),
      }),
    )
  })

  it("keeps the address and reports the failure when a rotation rejects", async () => {
    mockLoadIssuedOnchainAddress.mockResolvedValue({
      address: "bc1qfirst...",
      depositMarker: null,
    })
    mockReceiveOnchain
      .mockResolvedValueOnce({ address: "bc1qfirst..." })
      .mockRejectedValueOnce(new Error("rotation boom"))

    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qfirst...")
    })

    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
    rerender({})
    await flushEffects()

    expect(result.current?.onchainAddress).toBe("bc1qfirst...")
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "rotation boom" }),
    )
  })

  it("reports the failure when the automatic fetch rejects", async () => {
    mockReceiveOnchain.mockRejectedValue(new Error("fetch boom"))

    const { result } = renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "fetch boom" }),
      )
    })
    expect(result.current?.onchainAddress).toBeUndefined()
  })

  it("describes a non-Error rejection from the automatic fetch", async () => {
    mockReceiveOnchain.mockRejectedValue("string blowup")

    renderHook(() => usePaymentRequest())

    await waitFor(() => {
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Self-custodial receive onchain adapter failed: string blowup",
        }),
      )
    })
  })

  it("rotates again when a second deposit lands", async () => {
    mockLoadIssuedOnchainAddress.mockResolvedValue({
      address: "bc1qfirst...",
      depositMarker: "deposit-1",
    })
    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qfirst..." })

    const { result, rerender } = renderHook(() => usePaymentRequest())
    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qfirst...")
    })
    // Marker still matches the stored record, so nothing rotated yet.
    expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: false })

    mockReceiveOnchain.mockResolvedValue({ address: "bc1qsecond..." })
    mockSelfCustodialWallet.mockReturnValue(
      walletWith([onchainReceipt("deposit-2"), onchainReceipt("deposit-1")]),
    )
    rerender({})

    await waitFor(() => {
      expect(result.current?.onchainAddress).toBe("bc1qsecond...")
    })
    expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: true })
    expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
      address: "bc1qsecond...",
      depositMarker: "deposit-2",
      seenPendingDepositIds: [],
    })
  })

  it("ignores a slow initial fetch that resolves after the deposit rotation", async () => {
    // A deposit landing while the first request is still in flight starts a second
    // one. Without the request-sequence guard the stale response would overwrite the
    // freshly rotated address, silently putting the used address back on screen.
    let resolveInitial: (value: { address: string }) => void = () => {}
    mockReceiveOnchain
      .mockReturnValueOnce(
        new Promise<{ address: string }>((resolve) => {
          resolveInitial = resolve
        }),
      )
      .mockResolvedValueOnce({ address: "bc1qrotated..." })

    const { result, rerender } = renderHook(() => usePaymentRequest())
    await flushEffects()
    expect(result.current?.onchainAddress).toBeUndefined()

    mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
    rerender({})
    await flushEffects()
    expect(result.current?.onchainAddress).toBe("bc1qrotated...")

    await act(async () => {
      resolveInitial({ address: "bc1qstale..." })
      await flushEffects()
    })

    expect(result.current?.onchainAddress).toBe("bc1qrotated...")
    expect(mockSaveIssuedOnchainAddress).not.toHaveBeenCalledWith(
      "sc-account-1",
      expect.objectContaining({ address: "bc1qstale..." }),
    )
  })

  describe("unclaimed deposits", () => {
    /**
     * A deposit too small to clear the claim fee waits in `listPendingDeposits` and
     * never reaches the payment history, so the receipt marker alone would keep the
     * address it paid in circulation.
     */
    it("rotates when an unclaimed deposit appears", async () => {
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

      mockPendingDeposits.mockReturnValue({
        deposits: [pendingDeposit("txid-1")],
        refetch: jest.fn(),
      })
      rerender({})

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qrotated...")
      })
      expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: true })
      expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
        address: "bc1qrotated...",
        depositMarker: null,
        seenPendingDepositIds: ["txid-1:0"],
      })
    })

    it("leaves the address alone for a deposit it has already rotated for", async () => {
      mockLoadIssuedOnchainAddress.mockResolvedValue({
        address: "bc1qfirst...",
        depositMarker: null,
        seenPendingDepositIds: ["txid-1:0"],
      })
      mockPendingDeposits.mockReturnValue({
        deposits: [pendingDeposit("txid-1")],
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
    })

    it("keeps recorded ids when the listing comes back empty", async () => {
      // `usePendingDeposits` resolves to an empty array both when nothing is pending
      // and when the listing failed or has not run yet — forgetting the ids on that
      // would rotate again the moment the same deposits reappear.
      mockLoadIssuedOnchainAddress.mockResolvedValue({
        address: "bc1qfirst...",
        depositMarker: null,
        seenPendingDepositIds: ["txid-1:0"],
      })

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
      expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
        address: "bc1qtest...",
        depositMarker: null,
        seenPendingDepositIds: ["txid-1:0"],
      })
    })
  })

  describe("without a self-custodial account id", () => {
    it("still shows an address but neither reads nor writes the record", async () => {
      mockAccountRegistry.mockReturnValue({ activeAccount: undefined })

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
      expect(mockLoadIssuedOnchainAddress).not.toHaveBeenCalled()
      expect(mockSaveIssuedOnchainAddress).not.toHaveBeenCalled()
    })

    it("treats a custodial active account the same way", async () => {
      mockAccountRegistry.mockReturnValue({
        activeAccount: { id: "custodial-1", type: "custodial" },
      })

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockLoadIssuedOnchainAddress).not.toHaveBeenCalled()
      expect(mockSaveIssuedOnchainAddress).not.toHaveBeenCalled()
    })

    it("does not rotate on a deposit it would have no way to record", async () => {
      // Rotating here writes nothing, so the next run has the same evidence and rotates
      // again: a fresh address every render, and still no reuse tracking to show for it.
      mockAccountRegistry.mockReturnValue({ activeAccount: undefined })

      const { result, rerender } = renderHook(() => usePaymentRequest())
      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })

      mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))
      rerender({})
      await flushEffects()

      expect(mockReceiveOnchain).not.toHaveBeenCalledWith({ newAddress: true })
      expect(mockSaveIssuedOnchainAddress).not.toHaveBeenCalled()
    })

    it("rotates as soon as the account id is back", async () => {
      // The state above is transient — an account switch mid-render — so the pause on
      // rotation must not outlive it.
      mockAccountRegistry.mockReturnValue({ activeAccount: undefined })
      mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))

      const { result, rerender } = renderHook(() => usePaymentRequest())
      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: false })

      mockAccountRegistry.mockReturnValue({
        activeAccount: { id: "sc-account-1", type: "self-custodial" },
      })
      mockReceiveOnchain.mockResolvedValue({ address: "bc1qrotated..." })
      rerender({})

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qrotated...")
      })
      expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: true })
      expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
        address: "bc1qrotated...",
        depositMarker: "deposit-1",
        seenPendingDepositIds: [],
      })
    })
  })

  describe("when the deposit has scrolled off the loaded history", () => {
    /**
     * `allTransactions` only holds the newest page. A wallet that keeps paying over
     * Lightning pushes its on-chain receipt off that page, and the marker read from it
     * goes null — the same value a wallet that has never been paid produces. Falling
     * through to the SDK is what keeps those two apart. Reported as M1 on #4119.
     */
    it("rotates on a receipt only the SDK lookback can still see", async () => {
      mockLoadIssuedOnchainAddress.mockResolvedValue({
        address: "bc1qused...",
        depositMarker: "deposit-0",
      })
      mockSelfCustodialWallet.mockReturnValue(
        walletWith([{ ...onchainReceipt("ln-1"), paymentType: "lightning" }]),
      )
      mockFindLatestOnchainReceiptId.mockResolvedValue("deposit-1")
      mockReceiveOnchain.mockResolvedValue({ address: "bc1qrotated..." })

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qrotated...")
      })
      expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: true })
      expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
        address: "bc1qrotated...",
        depositMarker: "deposit-1",
        seenPendingDepositIds: [],
      })
    })

    it("rotates only once for that receipt", async () => {
      // The recorded marker is what stops the lookback from reading the same deposit as
      // new on every visit for as long as it stays off the loaded page.
      mockLoadIssuedOnchainAddress.mockResolvedValue({
        address: "bc1qrotated...",
        depositMarker: "deposit-1",
      })
      mockFindLatestOnchainReceiptId.mockResolvedValue("deposit-1")

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
    })

    it("skips the lookback when the loaded history already shows a receipt", async () => {
      // Anything newer would be on the page too, so the loaded marker is the answer.
      mockLoadIssuedOnchainAddress.mockResolvedValue({
        address: "bc1qfirst...",
        depositMarker: "deposit-1",
      })
      mockSelfCustodialWallet.mockReturnValue(walletWith([onchainReceipt("deposit-1")]))

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockFindLatestOnchainReceiptId).not.toHaveBeenCalled()
    })

    it("holds the address when the lookback finds nothing", async () => {
      mockLoadIssuedOnchainAddress.mockResolvedValue({
        address: "bc1qstored...",
        depositMarker: "deposit-1",
      })
      mockFindLatestOnchainReceiptId.mockResolvedValue(null)

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
      expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
        address: "bc1qtest...",
        depositMarker: "deposit-1",
        seenPendingDepositIds: [],
      })
    })

    it("still shows an address, keeps the marker and reports it when the lookback fails", async () => {
      // Offline is the common case: a failed lookback is "we do not know", so it must
      // neither rotate, nor erase the marker, nor leave the QR blank.
      mockLoadIssuedOnchainAddress.mockResolvedValue({
        address: "bc1qstored...",
        depositMarker: "deposit-1",
      })
      mockFindLatestOnchainReceiptId.mockRejectedValue(new Error("sdk offline"))

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockReceiveOnchain).toHaveBeenCalledWith({ newAddress: false })
      expect(mockSaveIssuedOnchainAddress).toHaveBeenLastCalledWith("sc-account-1", {
        address: "bc1qtest...",
        depositMarker: "deposit-1",
        seenPendingDepositIds: [],
      })
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "sdk offline" }),
      )
    })

    it("describes a non-Error lookback rejection", async () => {
      mockFindLatestOnchainReceiptId.mockRejectedValue("string blowup")

      const { result } = renderHook(() => usePaymentRequest())

      await waitFor(() => {
        expect(result.current?.onchainAddress).toBe("bc1qtest...")
      })
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Self-custodial onchain deposit marker lookup failed: string blowup",
        }),
      )
    })
  })
})
