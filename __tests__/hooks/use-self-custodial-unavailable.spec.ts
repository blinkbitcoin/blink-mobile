import { renderHook } from "@testing-library/react-native"

import { useSelfCustodialUnavailable } from "@app/hooks/use-self-custodial-unavailable"

const mockUseAccountRegistry = jest.fn()
const mockUseSelfCustodialRollback = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/hooks/use-self-custodial-rollback", () => ({
  useSelfCustodialRollback: (...args: unknown[]) => mockUseSelfCustodialRollback(...args),
}))

describe("useSelfCustodialUnavailable", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "a1" },
      accounts: [],
      setActiveAccountId: jest.fn(),
    })
  })

  it("returns true when rollback signals unavailable", () => {
    mockUseSelfCustodialRollback.mockReturnValue({ shouldShowUnavailable: true })

    const { result } = renderHook(() => useSelfCustodialUnavailable())

    expect(result.current).toBe(true)
  })

  it("returns false when rollback does not signal unavailable", () => {
    mockUseSelfCustodialRollback.mockReturnValue({ shouldShowUnavailable: false })

    const { result } = renderHook(() => useSelfCustodialUnavailable())

    expect(result.current).toBe(false)
  })

  it("forwards registry values to the rollback hook", () => {
    const setActiveAccountId = jest.fn()
    const accounts = [{ id: "x" }]
    const activeAccount = { id: "x" }
    mockUseAccountRegistry.mockReturnValue({
      activeAccount,
      accounts,
      setActiveAccountId,
    })
    mockUseSelfCustodialRollback.mockReturnValue({ shouldShowUnavailable: false })

    renderHook(() => useSelfCustodialUnavailable())

    expect(mockUseSelfCustodialRollback).toHaveBeenCalledWith({
      activeAccount,
      accounts,
      setActiveAccountId,
    })
  })
})
