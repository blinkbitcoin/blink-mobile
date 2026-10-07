import { renderHook, waitFor } from "@testing-library/react-native"

import { useMigrationDeletionGuard } from "@app/screens/account-migration/hooks/use-migration-deletion-guard"
import { ActiveWalletStatus } from "@app/types/wallet"

const PENDING_WALLET_ID = "sc-pending-1"
const OTHER_WALLET_ID = "sc-other-1"

const mockClearPendingWallet = jest.fn()

let mockInstanceId = "Staging"
let mockPendingAccountIds = new Set<string>()
let mockPendingLoading = false
let mockWalletState: {
  wallets: ReadonlyArray<{ balance: { amount: number } }>
  status: string
  connectedAccountId: string | null
}

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { id: mockInstanceId } } }),
}))

jest.mock("@app/screens/account-migration/hooks/use-pending-provisioned-wallets", () => ({
  usePendingProvisionedWallets: () => ({
    pendingAccountIds: mockPendingAccountIds,
    clearPendingWallet: (...args: readonly unknown[]) => mockClearPendingWallet(...args),
    loading: mockPendingLoading,
  }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockWalletState,
}))

const fundedWallets = [{ balance: { amount: 5000 } }]
const emptyWallets = [{ balance: { amount: 0 } }]

describe("useMigrationDeletionGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInstanceId = "Staging"
    mockPendingAccountIds = new Set([PENDING_WALLET_ID])
    mockPendingLoading = false
    mockWalletState = {
      wallets: emptyWallets,
      status: ActiveWalletStatus.Ready,
      connectedAccountId: null,
    }
  })

  it("does not block a wallet no migration has marked", () => {
    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(OTHER_WALLET_ID)).toBe(false)
  })

  /** The wallet is not the connected one, so nothing on this device can say whether the
   *  funds arrived: the mark stands. */
  it("blocks a marked wallet that is not the connected one", () => {
    mockWalletState.connectedAccountId = OTHER_WALLET_ID
    mockWalletState.wallets = fundedWallets

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
  })

  it("blocks a marked wallet whose balance is zero", () => {
    mockWalletState.connectedAccountId = PENDING_WALLET_ID
    mockWalletState.wallets = emptyWallets

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
  })

  /** A balance read before the SDK settled proves nothing, so a funded figure from a
   *  wallet still loading must not lift the block. */
  it("blocks a marked wallet whose funded balance is not settled yet", () => {
    mockWalletState.connectedAccountId = PENDING_WALLET_ID
    mockWalletState.wallets = fundedWallets
    mockWalletState.status = ActiveWalletStatus.Loading

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
    expect(mockClearPendingWallet).not.toHaveBeenCalled()
  })

  it("lifts the block once the proven mark is actually cleared", async () => {
    mockWalletState.connectedAccountId = PENDING_WALLET_ID
    mockWalletState.wallets = fundedWallets
    mockClearPendingWallet.mockImplementation(async (accountId: string) => {
      mockPendingAccountIds.delete(accountId)
    })

    const { result, rerender } = renderHook(() => useMigrationDeletionGuard())

    await waitFor(() =>
      expect(mockClearPendingWallet).toHaveBeenCalledWith(PENDING_WALLET_ID),
    )
    rerender(undefined)

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(false)
  })

  /**
   * The answer must follow the stored record, not a prediction of it: deleteWallet re-reads
   * that record at the moment of deletion, so a control offered while the mark still stands
   * would refuse once pressed.
   */
  it("stays blocked while the mark survives a failed heal, even with the funds proven", async () => {
    mockWalletState.connectedAccountId = PENDING_WALLET_ID
    mockWalletState.wallets = fundedWallets
    /** The clear reports and gives up, leaving the record as it was. */
    mockClearPendingWallet.mockResolvedValue(undefined)

    const { result, rerender } = renderHook(() => useMigrationDeletionGuard())

    await waitFor(() =>
      expect(mockClearPendingWallet).toHaveBeenCalledWith(PENDING_WALLET_ID),
    )
    rerender(undefined)

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
  })

  /** A migration abandoned halfway on purpose has to stay cleanable on the developer's own
   *  backend. */
  it("never blocks on the Local instance, even for a marked empty wallet", () => {
    mockInstanceId = "Local"
    mockWalletState.connectedAccountId = PENDING_WALLET_ID
    mockWalletState.wallets = emptyWallets

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(false)
  })

  /**
   * Staging runs on regtest like Local does, so the network cannot be what exempts: it is
   * where these flows are tested, and a block that switched itself off there could never be
   * verified by a device test.
   */
  it("blocks on Staging, which shares the regtest network with Local", () => {
    mockInstanceId = "Staging"
    mockWalletState.connectedAccountId = PENDING_WALLET_ID
    mockWalletState.wallets = emptyWallets

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
  })

  it("blocks on Main", () => {
    mockInstanceId = "Main"

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
  })

  /** Custom may point at a shared backend, so it is not handed the exemption. */
  it("blocks on a Custom instance", () => {
    mockInstanceId = "Custom"

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
  })

  /**
   * The deletion block is what Local is exempt from, not the record's hygiene: the switcher
   * hides a marked wallet on every instance, so a mark left behind there would keep a
   * settled wallet hidden for good.
   */
  it("still heals a proven mark on the Local instance, where only the block is exempt", async () => {
    mockInstanceId = "Local"
    mockWalletState.connectedAccountId = PENDING_WALLET_ID
    mockWalletState.wallets = fundedWallets

    renderHook(() => useMigrationDeletionGuard())

    await waitFor(() =>
      expect(mockClearPendingWallet).toHaveBeenCalledWith(PENDING_WALLET_ID),
    )
  })

  /**
   * A destructive control must not be offered on the strength of a record that has not been
   * read: the Danger Zone's is one the user types a confirmation into before deleteWallet
   * would get the chance to refuse.
   */
  it("blocks every wallet while the record is still being read", () => {
    mockPendingLoading = true

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
    expect(result.current.isDeletionBlocked(OTHER_WALLET_ID)).toBe(true)
  })

  it("blocks nothing while the record is being read on the Local instance", () => {
    mockPendingLoading = true
    mockInstanceId = "Local"

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(false)
  })

  it("reports the record settled once the read finishes", () => {
    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isLoading).toBe(false)
  })

  it("does not heal a funded wallet that carries no mark", async () => {
    mockWalletState.connectedAccountId = OTHER_WALLET_ID
    mockWalletState.wallets = fundedWallets

    renderHook(() => useMigrationDeletionGuard())

    await waitFor(() => expect(mockClearPendingWallet).not.toHaveBeenCalled())
  })

  /** The provider keeps serving the previous wallet's balances across a switch, so a mark
   *  may only ever be healed by the account those balances were synced for. */
  it("heals only the connected wallet, never another marked one", async () => {
    mockPendingAccountIds = new Set([PENDING_WALLET_ID, OTHER_WALLET_ID])
    mockWalletState.connectedAccountId = OTHER_WALLET_ID
    mockWalletState.wallets = fundedWallets
    mockClearPendingWallet.mockImplementation(async (accountId: string) => {
      mockPendingAccountIds.delete(accountId)
    })

    const { result, rerender } = renderHook(() => useMigrationDeletionGuard())

    await waitFor(() =>
      expect(mockClearPendingWallet).toHaveBeenCalledWith(OTHER_WALLET_ID),
    )
    expect(mockClearPendingWallet).toHaveBeenCalledTimes(1)
    rerender(undefined)

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
  })

  it("blocks when the connected account is unknown", () => {
    mockWalletState.connectedAccountId = null
    mockWalletState.wallets = fundedWallets

    const { result } = renderHook(() => useMigrationDeletionGuard())

    expect(result.current.isDeletionBlocked(PENDING_WALLET_ID)).toBe(true)
    expect(mockClearPendingWallet).not.toHaveBeenCalled()
  })
})
