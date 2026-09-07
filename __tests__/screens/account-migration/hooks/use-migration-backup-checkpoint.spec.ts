import { renderHook } from "@testing-library/react-native"

import { useMigrationBackupCheckpoint } from "@app/screens/account-migration/hooks/use-migration-backup-checkpoint"
import { MigrationCheckpoint } from "@app/screens/account-migration/utils/migration-checkpoint-storage"

import { flushEffects } from "../../../helpers/flush-effects"

const mockSaveCheckpoint = jest.fn()
let mockIsSelfCustodial = false
let mockHasResumableCheckpoint = true
let mockLoading = false

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: mockIsSelfCustodial }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint-state", () => ({
  useMigrationCheckpointState: () => ({
    hasResumableCheckpoint: mockHasResumableCheckpoint,
    loading: mockLoading,
    saveCheckpoint: mockSaveCheckpoint,
  }),
}))

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

describe("useMigrationBackupCheckpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSelfCustodial = false
    mockHasResumableCheckpoint = true
    mockLoading = false
    mockSaveCheckpoint.mockResolvedValue({ isSaved: true, failure: null })
  })

  it("advances the checkpoint when the backup belongs to the migration", () => {
    renderHook(() => useMigrationBackupCheckpoint(MigrationCheckpoint.CloudBackup))

    expect(mockSaveCheckpoint).toHaveBeenCalledWith(MigrationCheckpoint.CloudBackup)
  })

  /** Nothing here can be held back — the phrase is already on screen — but a step lost in
   *  silence sends the user back through a backup they already did, so it is reported. */
  it("reports a step the store refused to take", async () => {
    mockSaveCheckpoint.mockResolvedValue({ isSaved: false, failure: null })

    renderHook(() => useMigrationBackupCheckpoint(MigrationCheckpoint.CloudBackup))
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration backup checkpoint save",
      expect.any(Error),
    )
  })

  it("says nothing when the step is persisted", async () => {
    renderHook(() => useMigrationBackupCheckpoint(MigrationCheckpoint.CloudBackup))
    await flushEffects()

    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("waits for the checkpoint to load before saving", () => {
    mockLoading = true
    renderHook(() => useMigrationBackupCheckpoint(MigrationCheckpoint.CloudBackup))

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })

  it("does not touch the checkpoint when a self-custodial account is being backed up", () => {
    mockIsSelfCustodial = true
    renderHook(() => useMigrationBackupCheckpoint(MigrationCheckpoint.BackupMethod))

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })

  it("does not touch the checkpoint without a resumable migration", () => {
    mockHasResumableCheckpoint = false
    renderHook(() => useMigrationBackupCheckpoint(MigrationCheckpoint.BackupAlerts))

    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })
})
