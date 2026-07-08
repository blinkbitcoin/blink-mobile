import { renderHook } from "@testing-library/react-native"

import { useCompleteBackup } from "@app/screens/self-custodial/onboarding/hooks/use-complete-backup"
import { reportError } from "@app/utils/error-logging"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

let mockIsSelfCustodial = false
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: mockIsSelfCustodial }),
}))

let mockBackupStatus = "none"
const mockSetBackupCompleted = jest.fn()
const mockMarkBackupCompletedFor = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupStatus: { None: "none", Completed: "completed" },
  BackupMethod: { Cloud: "cloud", Keychain: "keychain", Manual: "manual" },
  useBackupState: () => ({
    backupState: { status: mockBackupStatus },
    setBackupCompleted: mockSetBackupCompleted,
  }),
  markBackupCompletedFor: (...args: readonly unknown[]) =>
    mockMarkBackupCompletedFor(...args),
}))

let mockCheckpoint: string | null = "backupAlerts"
let mockMigrationAccountId: string | null = "migration-uuid"
jest.mock("@app/screens/account-migration/hooks", () => ({
  useCompleteMigration: () => ({
    migrationCheckpoint: mockCheckpoint,
    migrationAccountId: mockMigrationAccountId,
  }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

describe("useCompleteBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSelfCustodial = false
    mockBackupStatus = "none"
    mockCheckpoint = "backupAlerts"
    mockMigrationAccountId = "migration-uuid"
    mockMarkBackupCompletedFor.mockResolvedValue(undefined)
  })

  it("marks the provisioned account and continues to the balance summary during a migration", async () => {
    const { result } = renderHook(() => useCompleteBackup())

    await result.current({ method: "manual" })

    expect(mockMarkBackupCompletedFor).toHaveBeenCalledWith("migration-uuid", "manual")
    expect(mockSetBackupCompleted).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  it("marks the active self-custodial account on a standalone backup (no migration)", () => {
    mockIsSelfCustodial = true

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "keychain", message: "All set" })

    expect(mockSetBackupCompleted).toHaveBeenCalledWith("keychain")
    expect(mockMarkBackupCompletedFor).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: "All set",
    })
  })

  it("does not route to the balance summary while migrating without a provisioned account", () => {
    // App killed between saving a step checkpoint and provisioning: checkpoint set, no id.
    mockMigrationAccountId = null

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "manual" })

    expect(mockMarkBackupCompletedFor).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalledWith("accountMigrationBalancesOverview")
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: undefined,
    })
  })

  it("reports the error and still navigates when the migration mark fails to persist", async () => {
    mockMarkBackupCompletedFor.mockRejectedValueOnce(new Error("disk full"))

    const { result } = renderHook(() => useCompleteBackup())

    await result.current({ method: "manual" })

    expect(reportError).toHaveBeenCalledWith(
      "Migration backup state persist",
      expect.any(Error),
    )
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  it("marks the active account as a re-backup when it was already backed up", () => {
    // An already-completed backup is never a migration, so it marks the active account.
    mockBackupStatus = "completed"

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "manual" })

    expect(mockSetBackupCompleted).toHaveBeenCalledWith("manual")
    expect(mockMarkBackupCompletedFor).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: true,
      message: undefined,
    })
  })
})
