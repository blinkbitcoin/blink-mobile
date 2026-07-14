import { renderHook, act } from "@testing-library/react-native"

import { useMigrationAccount } from "@app/screens/account-migration/hooks/use-migration-account"
import { MigrationCheckpoint } from "@app/screens/account-migration/utils/migration-checkpoint-storage"

const mockSaveCheckpoint = jest.fn()
const mockProvision = jest.fn()
const mockReportError = jest.fn()
const mockToastShow = jest.fn()
let mockAccountId: string | null = null

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

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ accounts: mockRegistryAccounts }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint-state", () => ({
  useMigrationCheckpointState: () => ({
    accountId: mockAccountId,
    loading: false,
    saveCheckpoint: mockSaveCheckpoint,
  }),
}))

jest.mock("@app/self-custodial/hooks/use-provision-self-custodial-account", () => ({
  useProvisionSelfCustodialAccount: () => ({ provision: mockProvision }),
}))

let mockGuardBlocked = false

jest.mock("@app/hooks/use-in-flight-guard", () => ({
  useInFlightGuard: () => ({
    run: <T>(fn: () => T) => (mockGuardBlocked ? undefined : fn()),
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { AccountTypeSelectionScreen: { createFailed: () => "creation failed" } },
  }),
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
    mockGuardBlocked = false
    mockSaveCheckpoint.mockResolvedValue(true)
    mockSavePendingAccount.mockResolvedValue(undefined)
    mockPendingForActiveAccount = null
    mockRegistryAccounts = []
    mockProvision.mockResolvedValue("sc-account-1")
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
      "sc-account-1",
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
      "sc-pending-1",
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
})
