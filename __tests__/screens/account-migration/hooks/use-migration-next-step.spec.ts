import { act, renderHook } from "@testing-library/react-native"

import { useMigrationNextStep } from "@app/screens/account-migration/hooks/use-migration-next-step"

const mockNavigate = jest.fn()
const mockNavigateToCheckpoint = jest.fn()
const mockReplaceToCheckpoint = jest.fn()
let mockHasResumableCheckpoint = false
let mockCheckpointLoading = false
let mockHasTransactions = false
let mockTransactionsLoading = false

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint", () => ({
  useMigrationCheckpoint: () => ({
    navigateToCheckpoint: mockNavigateToCheckpoint,
    replaceToCheckpoint: mockReplaceToCheckpoint,
    hasResumableCheckpoint: mockHasResumableCheckpoint,
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
    mockHasResumableCheckpoint = false
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

  it("returns to the checkpoint when resuming even with history", () => {
    mockHasTransactions = true
    mockHasResumableCheckpoint = true

    const { result } = renderHook(() => useMigrationNextStep())
    act(() => {
      result.current.goToNextStep()
    })

    expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("exposes the same checkpoint instance's replace for skip guards", () => {
    const { result } = renderHook(() => useMigrationNextStep())

    expect(result.current.replaceToCheckpoint).toBe(mockReplaceToCheckpoint)
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
