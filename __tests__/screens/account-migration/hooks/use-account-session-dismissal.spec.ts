import { act, renderHook } from "@testing-library/react-native"

import { useAccountSessionDismissal } from "@app/screens/account-migration/hooks/use-account-session-dismissal"

let mockOwnerId: string | null = "custodial-1"

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: mockOwnerId, loading: false }),
}))

describe("useAccountSessionDismissal", () => {
  beforeEach(() => {
    mockOwnerId = "custodial-1"
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

    mockOwnerId = "custodial-2"
    rerender({})
    expect(result.current.isDismissedForSession).toBe(false)

    mockOwnerId = "custodial-1"
    rerender({})
    expect(result.current.isDismissedForSession).toBe(true)
  })

  it("never reports dismissed while no account is active", () => {
    mockOwnerId = null

    const { result } = renderHook(() => useAccountSessionDismissal())

    act(() => {
      result.current.dismissForSession()
    })
    act(() => {
      result.current.reopen()
    })

    expect(result.current.isDismissedForSession).toBe(false)
  })
})
