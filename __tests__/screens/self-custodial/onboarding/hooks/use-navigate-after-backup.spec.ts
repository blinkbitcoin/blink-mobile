import { renderHook } from "@testing-library/react-native"

import { useNavigateAfterBackup } from "@app/screens/self-custodial/onboarding/hooks/use-navigate-after-backup"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

let mockIsSelfCustodial = false
let mockWallets: Array<{ balance: { amount: number } }> = [{ balance: { amount: 1000 } }]
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ wallets: mockWallets, isSelfCustodial: mockIsSelfCustodial }),
}))

let mockBackupStatus = "none"
jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupStatus: { None: "none", Completed: "completed" },
  useBackupState: () => ({ backupState: { status: mockBackupStatus } }),
}))

let mockCheckpoint: string | null = "backupAlerts"
jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({ checkpoint: mockCheckpoint }),
}))

describe("useNavigateAfterBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSelfCustodial = false
    mockWallets = [{ balance: { amount: 1000 } }]
    mockBackupStatus = "none"
    mockCheckpoint = "backupAlerts"
  })

  it("routes to the funds transfer during a funded migration", () => {
    const { result } = renderHook(() => useNavigateAfterBackup())

    result.current()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationTransferringFunds")
  })

  it("routes to success (skipping the transfer) when migrating without funds", () => {
    mockWallets = [{ balance: { amount: 0 } }]

    const { result } = renderHook(() => useNavigateAfterBackup())

    result.current()

    expect(mockNavigate).not.toHaveBeenCalledWith("accountMigrationTransferringFunds")
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: undefined,
    })
  })

  it("routes to success on a standalone self-custodial backup (no migration)", () => {
    mockIsSelfCustodial = true

    const { result } = renderHook(() => useNavigateAfterBackup())

    result.current()

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: undefined,
    })
  })

  it("marks reBackup when the wallet was already backed up", () => {
    // An already-completed backup is never a migration, so it lands on success as a re-backup.
    mockBackupStatus = "completed"

    const { result } = renderHook(() => useNavigateAfterBackup())

    result.current()

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: true,
      message: undefined,
    })
  })

  it("forwards the success message", () => {
    mockIsSelfCustodial = true

    const { result } = renderHook(() => useNavigateAfterBackup())

    result.current({ message: "All set" })

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
      message: "All set",
    })
  })
})
