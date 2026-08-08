import { act, renderHook } from "@testing-library/react-native"

import { useMigrationNextStep } from "@app/screens/account-migration/hooks/use-migration-next-step"

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockNavigateToCheckpoint = jest.fn()
const mockReplaceToCheckpoint = jest.fn()
let mockIsAtCommitPoint = false
let mockCheckpointLoading = false
let mockHasTransactions = false
let mockTransactionsLoading = false

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint", () => ({
  useMigrationCheckpoint: () => ({
    navigateToCheckpoint: mockNavigateToCheckpoint,
    replaceToCheckpoint: mockReplaceToCheckpoint,
    isAtCommitPoint: mockIsAtCommitPoint,
    loading: mockCheckpointLoading,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-has-transactions", () => ({
  useHasTransactions: () => ({
    hasTransactions: mockHasTransactions,
    loading: mockTransactionsLoading,
  }),
}))

describe("useMigrationNextStep", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAtCommitPoint = false
    mockCheckpointLoading = false
    mockHasTransactions = false
    mockTransactionsLoading = false
  })

  it("offers the history download to a fresh migration with history", () => {
    mockHasTransactions = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationDownloadHistory")
    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
  })

  it("skips the download for a fresh migration without history", () => {
    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("returns to the checkpoint when resuming at the commit point even with history", () => {
    mockHasTransactions = true
    mockIsAtCommitPoint = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** A flow left before the commit point replays every step, so the download it already
   *  skipped once is offered again rather than jumped over (#4109). */
  it("offers the history download again to a restarted pre-commit migration", () => {
    mockHasTransactions = true
    mockIsAtCommitPoint = false

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationDownloadHistory")
    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
  })

  /** A screen that skips itself must land where advancing through it would have, or the
   *  history export is silently lost on that path (#4109). */
  it("replaces onto the history download for a skip guard with history", () => {
    mockHasTransactions = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.replaceToNextStep()
    })

    expect(mockReplace).toHaveBeenCalledWith("accountMigrationDownloadHistory")
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("replaces onto the checkpoint for a skip guard without history", () => {
    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.replaceToNextStep()
    })

    expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("replaces onto the checkpoint for a skip guard at the commit point", () => {
    mockHasTransactions = true
    mockIsAtCommitPoint = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.replaceToNextStep()
    })

    expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("reports loading while the transaction check loads", () => {
    mockTransactionsLoading = true

    const { result } = renderHook(() => useMigrationNextStep())

    expect(result.current.loading).toBe(true)
  })

  it("reports loading while the checkpoint loads", () => {
    mockCheckpointLoading = true

    const { result } = renderHook(() => useMigrationNextStep())

    expect(result.current.loading).toBe(true)
  })
})
