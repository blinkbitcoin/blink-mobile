import { renderHook } from "@testing-library/react-native"

import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"

const mockUseIsAuthed = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

describe("useHasCustodialAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns true when user is authenticated", () => {
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useHasCustodialAccount())

    expect(result.current).toBe(true)
  })

  it("returns false when user is not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)

    const { result } = renderHook(() => useHasCustodialAccount())

    expect(result.current).toBe(false)
  })
})
