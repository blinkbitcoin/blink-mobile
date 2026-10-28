import { renderHook } from "@testing-library/react-native"

import { MigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { useCompleteBackup } from "@app/screens/self-custodial/onboarding/hooks/use-complete-backup"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import { StorageFailure } from "@app/utils/storage/storage-failure"

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockSaveCheckpoint = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
}))

let mockAccountType: AccountType = AccountType.Custodial
let mockIsSelfCustodial = false
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({
    accountType: mockAccountType,
    isSelfCustodial: mockIsSelfCustodial,
  }),
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
    saveCheckpoint: mockSaveCheckpoint,
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
    mockAccountType = AccountType.Custodial
    mockIsSelfCustodial = false
    mockBackupStatus = "none"
    mockCheckpoint = "backupAlerts"
    mockMigrationAccountId = "migration-uuid"
    mockMarkBackupCompletedFor.mockResolvedValue(undefined)
    mockSaveCheckpoint.mockResolvedValue({ isSaved: true, failure: null })
  })

  it("marks the provisioned account and continues to the balance summary during a migration", async () => {
    const { result } = renderHook(() => useCompleteBackup())

    await result.current({ method: "manual" })

    expect(mockMarkBackupCompletedFor).toHaveBeenCalledWith(
      "migration-uuid",
      "manual",
      undefined,
    )
    expect(mockSetBackupCompleted).not.toHaveBeenCalled()
    expect(mockSaveCheckpoint).toHaveBeenCalledWith(MigrationCheckpoint.ChooseExperience)
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: {
        route: "accountMigrationBalancesOverview",
        accountId: "migration-uuid",
      },
    })
    // The provisioned account has no funds and so no bundle yet: the export step,
    // which reads the active account, is never reached from a migration.
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupBundleExport",
      expect.anything(),
    )
    expect(reportError).not.toHaveBeenCalled()
  })

  /** The mode screen is not a commit point, so a resume routes to the explainer with or
   *  without this checkpoint. Blocking on the write would buy no resume behaviour and would
   *  strand a user who just finished their backup on a screen with nothing left to do. */
  it("continues to the mode screen when the checkpoint write fails", async () => {
    mockSaveCheckpoint.mockResolvedValueOnce({
      isSaved: false,
      failure: StorageFailure.Unknown,
    })

    const { result } = renderHook(() => useCompleteBackup())

    await result.current({ method: "manual" })

    expect(mockToastShow).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: {
        route: "accountMigrationBalancesOverview",
        accountId: "migration-uuid",
      },
    })
    /** Not gated on, but reported: it is the same store the commit point depends on. */
    expect(reportError).toHaveBeenCalledWith(
      "Migration choose-experience checkpoint save",
      expect.any(Error),
    )
  })

  /** Not gated on, but not silent either: a store refusing this write is the same store
   *  the commit point is about to depend on. */
  it("reports a choose-experience checkpoint write the store refused", async () => {
    mockSaveCheckpoint.mockResolvedValueOnce({
      isSaved: false,
      failure: StorageFailure.Unknown,
    })

    const { result } = renderHook(() => useCompleteBackup())

    await result.current({ method: "manual" })

    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      "Migration choose-experience checkpoint save",
      expect.objectContaining({ message: "Choose-experience step was not persisted" }),
    )
  })

  it("reports nothing when the choose-experience checkpoint write lands", async () => {
    const { result } = renderHook(() => useCompleteBackup())

    await result.current({ method: "manual" })

    expect(mockSaveCheckpoint).toHaveBeenCalledWith(MigrationCheckpoint.ChooseExperience)
    expect(reportError).not.toHaveBeenCalled()
  })

  it("marks the active self-custodial account on a standalone backup (no migration)", () => {
    mockAccountType = AccountType.SelfCustodial
    mockIsSelfCustodial = true

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "keychain", message: "All set" })

    expect(mockSetBackupCompleted).toHaveBeenCalledWith("keychain", undefined)
    expect(mockMarkBackupCompletedFor).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: "All set",
    })
  })

  it("sends a cloud backup straight to success, past the emergency bundle screen", () => {
    mockAccountType = AccountType.SelfCustodial
    mockIsSelfCustodial = true
    mockCheckpoint = null

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "cloud" })

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: undefined,
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupBundleExport",
      expect.anything(),
    )
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
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialChooseExperience",
      expect.anything(),
    )
  })

  /** The emergency bundle is not part of the backup flow: a manual backup keeps
   *  it on this device and hands it over from Settings only. */
  it("records a first manual backup and goes straight to success", () => {
    mockAccountType = AccountType.SelfCustodial
    mockIsSelfCustodial = true

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "manual", message: "All set" })

    expect(mockSetBackupCompleted).toHaveBeenCalledWith("manual", undefined)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: "All set",
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupBundleExport",
      expect.anything(),
    )
  })

  it("marks the active account as a re-backup and goes straight to success", () => {
    // An already-completed backup is never a migration, so it marks the active account.
    mockBackupStatus = "completed"
    mockAccountType = AccountType.SelfCustodial
    mockIsSelfCustodial = true

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "manual" })

    expect(mockSetBackupCompleted).toHaveBeenCalledWith("manual", undefined)
    expect(mockMarkBackupCompletedFor).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: true,
      message: undefined,
    })
  })

  it("finishes a manual backup straight away for an account that has no recovery bundle", () => {
    // Custodial and not migrating: there is no self-custodial bundle to hand over.
    mockCheckpoint = null

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "manual" })

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: undefined,
    })
  })

  it("keeps a self-custodial account out of the migration branch while its wallet is still starting", () => {
    mockAccountType = AccountType.SelfCustodial
    mockIsSelfCustodial = false

    const { result } = renderHook(() => useCompleteBackup())

    result.current({ method: "manual" })

    expect(mockMarkBackupCompletedFor).not.toHaveBeenCalled()
    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
    expect(mockSetBackupCompleted).toHaveBeenCalledWith("manual", undefined)
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: undefined,
    })
  })
})
