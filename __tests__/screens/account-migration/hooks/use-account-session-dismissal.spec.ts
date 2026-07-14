import { act, renderHook } from "@testing-library/react-native"

import { useAccountSessionDismissal } from "@app/screens/account-migration/hooks/use-account-session-dismissal"

let mockActiveAccount: { id: string; type: string } | undefined

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

describe("useAccountSessionDismissal", () => {
  beforeEach(() => {
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
  })

  it("starts undismissed", () => {
    const { result } = renderHook(() => useAccountSessionDismissal())

    expect(result.current.isDismissedForSession).toBe(false)
  })

  it("dismisses for the active account", () => {
    const { result } = renderHook(() => useAccountSessionDismissal())

    act(() => {
      result.current.dismissForSession()
    })

    expect(result.current.isDismissedForSession).toBe(true)
  })

  it("reopens after a dismissal", () => {
    const { result } = renderHook(() => useAccountSessionDismissal())

    act(() => {
      result.current.dismissForSession()
    })
    act(() => {
      result.current.reopen()
    })

    expect(result.current.isDismissedForSession).toBe(false)
  })

  it("keeps each account's dismissal isolated across switches", () => {
    const { result, rerender } = renderHook(() => useAccountSessionDismissal())

    act(() => {
      result.current.dismissForSession()
    })

    mockActiveAccount = { id: "custodial-2", type: "custodial" }
    rerender({})
    expect(result.current.isDismissedForSession).toBe(false)

    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    rerender({})
    expect(result.current.isDismissedForSession).toBe(true)
  })

  it("never reports dismissed while no account is active", () => {
    mockActiveAccount = undefined

    const { result } = renderHook(() => useAccountSessionDismissal())

    act(() => {
      result.current.dismissForSession()
    })

    expect(result.current.isDismissedForSession).toBe(false)
  })
})
