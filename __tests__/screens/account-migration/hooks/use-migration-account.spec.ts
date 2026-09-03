import { renderHook, act } from "@testing-library/react-native"

import { useMigrationAccount } from "@app/screens/account-migration/hooks/use-migration-account"
import {
  ImportWalletError,
  SelfCustodialImportError,
} from "@app/self-custodial/hooks/use-import-self-custodial-account"
import { MigrationCheckpoint } from "@app/screens/account-migration/utils/migration-checkpoint-storage"

const mockSaveCheckpoint = jest.fn()
const mockProvision = jest.fn()
const mockImportWallet = jest.fn()
const mockUpdateState = jest.fn()
const mockWithModeFromServer = jest.fn()
const mockReportError = jest.fn()
const mockToastShow = jest.fn()
let mockAccountId: string | null = null
let mockStoredTargetOrigin: string | undefined
let mockOwnerId: string | null = "custodial-1"

let mockPendingForActiveAccount: string | null = null
let mockRegistryAccounts: { id: string }[] = []
const mockSavePendingAccount = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-pending-migration-accounts", () => ({
  usePendingMigrationAccounts: () => ({
    pendingForActiveAccount: mockPendingForActiveAccount,
    savePendingAccount: mockSavePendingAccount,
    loading: false,
  }),
}))

let mockRegistryLoading = false

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    accounts: mockRegistryAccounts,
    loading: mockRegistryLoading,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint-state", () => ({
  useMigrationCheckpointState: () => ({
    accountId: mockAccountId,
    storedTargetOrigin: mockStoredTargetOrigin,
    loading: false,
    saveCheckpoint: mockSaveCheckpoint,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: mockOwnerId }),
}))

jest.mock("@app/self-custodial/hooks/use-provision-self-custodial-account", () => ({
  useProvisionSelfCustodialAccount: () => ({ provision: mockProvision }),
}))

/** requireActual keeps the real error class and reason enum, so the hook's `instanceof`
 *  check is exercised rather than mocked into always-true. */
jest.mock("@app/self-custodial/hooks/use-import-self-custodial-account", () => ({
  ...jest.requireActual("@app/self-custodial/hooks/use-import-self-custodial-account"),
  useImportSelfCustodialAccount: () => ({ importWallet: mockImportWallet }),
}))

let mockGuardBlocked = false

jest.mock("@app/hooks/use-in-flight-guard", () => ({
  useInFlightGuard: () => ({
    run: <T>(fn: () => T) => (mockGuardBlocked ? undefined : fn()),
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: { createFailed: () => "creation failed" },
      RestoreScreen: { invalidMnemonic: () => "invalid phrase" },
    },
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdateState }),
}))

jest.mock("@app/store/persistent-state/self-custodial-server-account-mode", () => ({
  withSelfCustodialModeFromServer: (...args: readonly unknown[]) =>
    mockWithModeFromServer(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

describe("useMigrationAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountId = null
    mockStoredTargetOrigin = undefined
    mockOwnerId = "custodial-1"
    mockGuardBlocked = false
    mockSaveCheckpoint.mockResolvedValue(true)
    mockSavePendingAccount.mockResolvedValue(undefined)
    mockPendingForActiveAccount = null
    mockRegistryAccounts = []
    mockRegistryLoading = false
    mockProvision.mockImplementation(
      async (beforeCreate?: (accountId: string) => Promise<void>) => {
        if (beforeCreate) await beforeCreate("sc-account-1")
        return "sc-account-1"
      },
    )
    mockImportWallet.mockResolvedValue({
      accountId: "sc-imported-1",
      restored: { serverMode: null, isServerModeKnown: false },
    })
  })

  it("returns the already provisioned account without provisioning again", async () => {
    mockAccountId = "sc-account-1"
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-account-1")
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })

  it("provisions the account and checkpoints the terms step with its id", async () => {
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-account-1")
    expect(mockSaveCheckpoint).toHaveBeenCalledWith(
      MigrationCheckpoint.TermsAndConditions,
      { provisionedAccountId: "sc-account-1", targetOrigin: "provisioned" },
    )
  })

  it("returns null while another provisioning run is in flight", async () => {
    mockGuardBlocked = true
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it("stops the flow with the failure toast when the checkpoint write fails", async () => {
    mockSaveCheckpoint.mockResolvedValue(false)
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockReportError).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("reports the error and returns null when provisioning fails", async () => {
    mockProvision.mockRejectedValue(new Error("provision failed"))
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockReportError).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("aborts provisioning with the failure toast when the pending-record save throws", async () => {
    mockSavePendingAccount.mockRejectedValue(new Error("record write failed"))
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("records the freshly provisioned wallet as pending for reuse", async () => {
    const { result } = renderHook(() => useMigrationAccount())

    await act(async () => {
      await result.current.ensureAccount()
    })

    expect(mockSavePendingAccount).toHaveBeenCalledWith("sc-account-1")
  })

  it("reuses the pending wallet of an earlier abandoned run", async () => {
    mockPendingForActiveAccount = "sc-pending-1"
    mockRegistryAccounts = [{ id: "sc-pending-1" }]

    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-pending-1")
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockSavePendingAccount).not.toHaveBeenCalled()
    expect(mockSaveCheckpoint).toHaveBeenCalledWith(
      MigrationCheckpoint.TermsAndConditions,
      { provisionedAccountId: "sc-pending-1", targetOrigin: "provisioned" },
    )
  })

  it("provisions fresh when the pending wallet no longer exists on the device", async () => {
    mockPendingForActiveAccount = "sc-gone-1"
    mockRegistryAccounts = []

    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-account-1")
    expect(mockProvision).toHaveBeenCalledTimes(1)
    expect(mockSavePendingAccount).toHaveBeenCalledWith("sc-account-1")
  })

  describe("importAccount", () => {
    it("imports the phrase's wallet and checkpoints the terms step with its id", async () => {
      const { result } = renderHook(() => useMigrationAccount())

      let imported: string | null = null
      await act(async () => {
        imported = await result.current.importAccount("phrase")
      })

      expect(imported).toBe("sc-imported-1")
      expect(mockImportWallet).toHaveBeenCalledWith("phrase")
      /** The wallet is the user's, not a disposable one this flow made: recording it as
       *  pending would hide it from the account switcher if the run is abandoned. */
      expect(mockSavePendingAccount).not.toHaveBeenCalled()
      expect(mockProvision).not.toHaveBeenCalled()
      expect(mockSaveCheckpoint).toHaveBeenCalledWith("termsAndConditions", {
        provisionedAccountId: "sc-imported-1",
        targetOrigin: "restored",
      })
    })

    /** An earlier run's wallet must never answer for a phrase the user just typed: the
     *  custodial balance would drain into a wallet they hold no phrase for. */
    it("imports the phrase even when an earlier run already checkpointed a wallet", async () => {
      mockAccountId = "sc-provisioned-earlier"
      const { result } = renderHook(() => useMigrationAccount())

      let imported: string | null = null
      await act(async () => {
        imported = await result.current.importAccount("phrase")
      })

      expect(imported).toBe("sc-imported-1")
      expect(mockImportWallet).toHaveBeenCalledTimes(1)
      expect(mockSaveCheckpoint).toHaveBeenCalledWith("termsAndConditions", {
        provisionedAccountId: "sc-imported-1",
        targetOrigin: "restored",
      })
    })

    /** The phrase names the wallet. Reusing the one an abandoned run left behind would
     *  migrate into a wallet the user did not ask for. */
    it("ignores a reusable pending wallet and uses the phrase's wallet instead", async () => {
      mockPendingForActiveAccount = "sc-abandoned-1"
      mockRegistryAccounts = [{ id: "sc-abandoned-1" }]
      const { result } = renderHook(() => useMigrationAccount())

      let imported: string | null = null
      await act(async () => {
        imported = await result.current.importAccount("phrase")
      })

      expect(imported).toBe("sc-imported-1")
    })

    it("tells the user the phrase is unusable instead of reporting a creation failure", async () => {
      mockImportWallet.mockRejectedValue(
        new SelfCustodialImportError(ImportWalletError.InvalidMnemonic),
      )
      const { result } = renderHook(() => useMigrationAccount())

      let imported: string | null = null
      await act(async () => {
        imported = await result.current.importAccount("not a phrase")
      })

      expect(imported).toBeNull()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "invalid phrase" }),
      )
    })

    /** A phrase that is valid but whose lookup failed is not the user's mistake to fix, so
     *  it keeps the generic message. */
    it("keeps the generic failure message for an import fault that is not the phrase", async () => {
      mockImportWallet.mockRejectedValue(
        new SelfCustodialImportError(ImportWalletError.LookupFailed),
      )
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.importAccount("phrase")
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "creation failed" }),
      )
    })

    /** The mode the server holds was chosen on a device this one may never have been.
     *  Defaulting to Enhanced here would push that back over an Anon wallet. */
    it("adopts the server mode the restore reported", async () => {
      mockImportWallet.mockResolvedValue({
        accountId: "sc-imported-1",
        restored: { serverMode: "anon", isServerModeKnown: true },
      })
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.importAccount("phrase")
      })

      expect(mockUpdateState).toHaveBeenCalledTimes(1)

      const updater = mockUpdateState.mock.calls[0][0]
      const previous = { some: "state" }
      updater(previous)
      expect(mockWithModeFromServer).toHaveBeenCalledWith(
        previous,
        "sc-imported-1",
        "anon",
      )

      /** No stored state yet means there is nothing to write the mode into. */
      mockWithModeFromServer.mockClear()
      expect(updater(null)).toBeNull()
      expect(mockWithModeFromServer).not.toHaveBeenCalled()
    })

    /** An unanswered server is not the same as an answer of "none": adopting it would turn
     *  a stored Anon into Enhanced on the strength of a request that never landed. */
    it("leaves the stored mode alone when the server could not be asked", async () => {
      mockImportWallet.mockResolvedValue({
        accountId: "sc-imported-1",
        restored: { serverMode: null, isServerModeKnown: false },
      })
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.importAccount("phrase")
      })

      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("leaves the stored mode alone for a wallet already on the device", async () => {
      mockImportWallet.mockResolvedValue({ accountId: "already-here" })
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.importAccount("phrase")
      })

      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    /** The provision path is protected by savePendingAccount, which throws before the
     *  wallet exists. Imports record no pending account, so without an explicit refusal an
     *  unresolved owner would be discovered only after a wallet was derived and registered. */
    it("refuses before deriving a wallet when the custodial owner is unresolved", async () => {
      mockOwnerId = null
      const { result } = renderHook(() => useMigrationAccount())

      let imported: string | null = null
      await act(async () => {
        imported = await result.current.importAccount("phrase")
      })

      expect(imported).toBeNull()
      expect(mockImportWallet).not.toHaveBeenCalled()
      expect(mockSaveCheckpoint).not.toHaveBeenCalled()
    })

    /** A second pass over the same phrase finds the wallet already on the device and would
     *  read as adopted, costing a restored wallet its settings carry-over. */
    it("keeps the origin recorded on the first pass when the phrase is re-submitted", async () => {
      mockAccountId = "sc-imported-1"
      mockStoredTargetOrigin = "restored"
      mockImportWallet.mockResolvedValue({ accountId: "sc-imported-1" })
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.importAccount("phrase")
      })

      expect(mockSaveCheckpoint).toHaveBeenCalledWith("termsAndConditions", {
        provisionedAccountId: "sc-imported-1",
        targetOrigin: "restored",
      })
    })

    /** A stored origin belonging to a different wallet must not be inherited. */
    it("classifies afresh when the checkpoint names another wallet", async () => {
      mockAccountId = "sc-someone-else"
      mockStoredTargetOrigin = "restored"
      mockImportWallet.mockResolvedValue({ accountId: "sc-imported-1" })
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.importAccount("phrase")
      })

      expect(mockSaveCheckpoint).toHaveBeenCalledWith("termsAndConditions", {
        provisionedAccountId: "sc-imported-1",
        targetOrigin: "adopted",
      })
    })

    it("stops the flow with the failure toast when the checkpoint write fails", async () => {
      mockSaveCheckpoint.mockResolvedValue(false)
      const { result } = renderHook(() => useMigrationAccount())

      let imported: string | null = null
      await act(async () => {
        imported = await result.current.importAccount("phrase")
      })

      expect(imported).toBeNull()
      expect(mockReportError).toHaveBeenCalled()
    })
  })
})
