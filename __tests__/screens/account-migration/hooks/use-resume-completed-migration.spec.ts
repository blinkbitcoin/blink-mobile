import { renderHook } from "@testing-library/react-native"

import { MigrationStatus } from "@app/graphql/generated"
import { useResumeCompletedMigration } from "@app/screens/account-migration/hooks/use-resume-completed-migration"

import { flushEffects } from "../../../helpers/flush-effects"

const mockCompleteMigration = jest.fn()
const mockUseMigrationStatus = jest.fn()
const mockReportError = jest.fn()

let mockStatus: MigrationStatus | null = MigrationStatus.Completed
let mockMigrationAccountId: string | null = "sc-account-1"
let mockMigrationLoading = false

jest.mock("@app/screens/account-migration/hooks/use-complete-migration", () => ({
  useCompleteMigration: () => ({
    migrationAccountId: mockMigrationAccountId,
    migrationLoading: mockMigrationLoading,
    completeMigration: mockCompleteMigration,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-status", () => ({
  useMigrationStatus: (options: unknown) => {
    mockUseMigrationStatus(options)
    return { status: mockStatus, loading: false, isSkipped: false }
  },
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

describe("useResumeCompletedMigration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStatus = MigrationStatus.Completed
    mockMigrationAccountId = "sc-account-1"
    mockMigrationLoading = false
    mockCompleteMigration.mockResolvedValue(true)
  })

  /**
   * The transfer ends in two steps and only the transfer screen watches for the first, so
   * an app killed between them would open on the emptied custodial account with the
   * funded wallet unused in the switcher.
   */
  it("finishes a swap the device never ran", async () => {
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
  })

  it("swaps once per launch, however often it re-renders", async () => {
    const { rerender } = renderHook(() => useResumeCompletedMigration())
    await flushEffects()
    rerender({})
    rerender({})
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
  })

  it("leaves a migration the server has not finished alone", async () => {
    mockStatus = MigrationStatus.Transferring
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).not.toHaveBeenCalled()
  })

  it("waits for the checkpoint before deciding there is a swap to finish", async () => {
    mockMigrationLoading = true
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockCompleteMigration).not.toHaveBeenCalled()
  })

  /** Nobody who cannot act on the answer should be asking for it on every launch. */
  it("does not ask the server when no checkpoint says a migration is unfinished", async () => {
    mockMigrationAccountId = null
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenCalledWith({ skip: true })
    expect(mockCompleteMigration).not.toHaveBeenCalled()
  })

  it("asks the server when a checkpoint says one is unfinished", async () => {
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockUseMigrationStatus).toHaveBeenCalledWith({ skip: false })
  })

  /** The funds have already landed, so a failed swap is a launch that can retry, not a
   *  reason to strand the user anywhere. */
  it("reports a swap that throws without escaping", async () => {
    mockCompleteMigration.mockRejectedValue(new Error("keystore locked"))
    renderHook(() => useResumeCompletedMigration())
    await flushEffects()

    expect(mockReportError).toHaveBeenCalledWith(
      "Migration resume swap",
      expect.objectContaining({ message: "keystore locked" }),
    )
  })
})
