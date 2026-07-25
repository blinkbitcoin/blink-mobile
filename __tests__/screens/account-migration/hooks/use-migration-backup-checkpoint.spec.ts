import { renderHook } from "@testing-library/react-native"

import { useMigrationBackupCheckpoint } from "@app/screens/account-migration/hooks/use-migration-backup-checkpoint"
import { MigrationCheckpoint } from "@app/screens/account-migration/utils/migration-checkpoint-storage"

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

describe("useMigrationBackupCheckpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSelfCustodial = false
    mockHasResumableCheckpoint = true
    mockLoading = false
  })

  it("advances the checkpoint when the backup belongs to the migration", () => {
    renderHook(() => useMigrationBackupCheckpoint(MigrationCheckpoint.CloudBackup))

    expect(mockSaveCheckpoint).toHaveBeenCalledWith(MigrationCheckpoint.CloudBackup)
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
