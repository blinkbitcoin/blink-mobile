import { renderHook } from "@testing-library/react-native"

import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"

const mockUsePersistentStateContext = jest.fn()

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => mockUsePersistentStateContext(),
}))

describe("useHasCustodialAccount", () => {
  it("returns true when galoyAuthToken is set", () => {
    mockUsePersistentStateContext.mockReturnValue({
      persistentState: { galoyAuthToken: "abc123" },
    })

    const { result } = renderHook(() => useHasCustodialAccount())

    expect(result.current).toBe(true)
  })

  it("returns false when galoyAuthToken is empty", () => {
    mockUsePersistentStateContext.mockReturnValue({
      persistentState: { galoyAuthToken: "" },
    })

    const { result } = renderHook(() => useHasCustodialAccount())

    expect(result.current).toBe(false)
  })
})
