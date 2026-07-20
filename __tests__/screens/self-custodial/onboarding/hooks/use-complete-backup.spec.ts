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
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationCheckpointState: () => ({
    checkpoint: mockCheckpoint,
    accountId: mockMigrationAccountId,
  }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountMigration: { resumeFailed: () => "resume failed" },
      errors: { generic: () => "generic error" },
    },
  }),
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

  it("surfaces a lost resume state instead of faking a standalone success", () => {
    /** App killed between saving a step checkpoint and provisioning: checkpoint set, no id. */
    mockMigrationAccountId = null

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "manual" })

    expect(mockMarkBackupCompletedFor).not.toHaveBeenCalled()
    expect(mockSetBackupCompleted).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "resume failed" }),
    )
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationExplainer")
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupSuccess",
      expect.anything(),
    )
  })

  it("stops at the backup screen and toasts instead of advancing when the mark fails", async () => {
    mockMarkBackupCompletedFor.mockRejectedValueOnce(new Error("disk full"))

    const { result } = renderHook(() => useCompleteBackup())

    await result.current({ method: "manual" })

    expect(reportError).toHaveBeenCalledWith(
      "Migration backup state persist",
      expect.any(Error),
    )
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "generic error" }),
    )
    expect(mockNavigate).not.toHaveBeenCalledWith("accountMigrationBalancesOverview")
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
