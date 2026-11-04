import React from "react"
import { act, renderHook } from "@testing-library/react-native"

import {
  useWindDownStatus,
  WindDownStatusProvider,
} from "@app/screens/account-migration/hooks/use-wind-down-status"
import { WindDownStatus } from "@app/types/wind-down"

/** How long the provider promises to wait for the wind-down's answer, pinned here. */
const ANSWER_WAIT_MS = 5_000

const mockUseWindDownQuery = jest.fn()

let mockIsAuthed = true

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWindDownQuery: (options: unknown) => mockUseWindDownQuery(options),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

const serverWindDown = {
  __typename: "AccountWindDown" as const,
  status: WindDownStatus.PreCutoff,
  receiveDisabledAt: 1_790_000_000,
  finalDeadline: 1_790_100_000,
  gateArmsAt: 1_790_200_000,
  timezone: "Europe/Paris",
}

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <WindDownStatusProvider>{children}</WindDownStatusProvider>
)

const renderStatus = () => renderHook(() => useWindDownStatus(), { wrapper })

describe("useWindDownStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("serves the account's wind-down state, mapped to the domain shape", () => {
    mockUseWindDownQuery.mockReturnValue({
      data: { windDown: serverWindDown },
      loading: false,
    })

    const { result } = renderStatus()

    const { __typename, ...domainWindDown } = serverWindDown
    expect(result.current.windDown).toEqual(domainWindDown)
    expect(result.current.isPending).toBe(false)
  })

  it("returns null when the wind-down does not affect the account", () => {
    mockUseWindDownQuery.mockReturnValue({ data: { windDown: null }, loading: false })

    const { result } = renderStatus()

    expect(result.current.windDown).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it("is pending, with no wind-down yet, while the query is still in flight", () => {
    mockUseWindDownQuery.mockReturnValue({ data: undefined, loading: true })

    const { result } = renderStatus()

    expect(result.current.windDown).toBeNull()
    expect(result.current.isPending).toBe(true)
  })

  it("skips the query and stays null while the user is not authenticated", () => {
    mockIsAuthed = false
    mockUseWindDownQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderStatus()

    expect(mockUseWindDownQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "no-cache",
    })
    expect(result.current.windDown).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it("fetches without touching the cache so a switch never serves the previous account's status", () => {
    mockUseWindDownQuery.mockReturnValue({ data: { windDown: null } })

    renderStatus()

    expect(mockUseWindDownQuery).toHaveBeenCalledWith({
      skip: false,
      fetchPolicy: "no-cache",
    })
  })

  /** A network that never answers must not hold the surfaces that yield to the
   *  wind-down for the session; a late answer still reaches them. */
  it("stops pending once the answer has been waited for long enough, and still serves a late answer", () => {
    jest.useFakeTimers()
    mockUseWindDownQuery.mockReturnValue({ data: undefined, loading: true })
    const { result, rerender } = renderStatus()
    expect(result.current.isPending).toBe(true)

    act(() => {
      jest.advanceTimersByTime(ANSWER_WAIT_MS - 1)
    })
    expect(result.current.isPending).toBe(true)

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.isPending).toBe(false)
    expect(result.current.windDown).toBeNull()

    mockUseWindDownQuery.mockReturnValue({
      data: { windDown: serverWindDown },
      loading: false,
    })
    rerender({})

    expect(result.current.windDown).toMatchObject({ status: WindDownStatus.PreCutoff })
    expect(result.current.isPending).toBe(false)
  })

  it("waits anew for a read that starts over", () => {
    jest.useFakeTimers()
    mockUseWindDownQuery.mockReturnValue({ data: undefined, loading: true })
    const { result, rerender } = renderStatus()
    act(() => {
      jest.advanceTimersByTime(ANSWER_WAIT_MS)
    })
    expect(result.current.isPending).toBe(false)

    mockUseWindDownQuery.mockReturnValue({ data: { windDown: null }, loading: false })
    rerender({})
    mockUseWindDownQuery.mockReturnValue({ data: undefined, loading: true })
    rerender({})

    expect(result.current.isPending).toBe(true)
  })

  /** One read for every surface that acts on the wind-down: the push into the
   *  migration and the two-factor gate that yields to it cannot disagree. */
  it("serves every reader from the one read", () => {
    mockUseWindDownQuery.mockReturnValue({
      data: { windDown: serverWindDown },
      loading: false,
    })

    const { result } = renderHook(
      () => ({ first: useWindDownStatus(), second: useWindDownStatus() }),
      { wrapper },
    )

    expect(mockUseWindDownQuery).toHaveBeenCalledTimes(1)
    expect(result.current.first).toBe(result.current.second)
  })

  /** The status flips at the cutoff, and a session can straddle it: a surface that
   *  must decide from the status as it is now asks again. */
  it("asks the server again on refresh", () => {
    const mockRefetch = jest.fn(() => Promise.resolve())
    mockUseWindDownQuery.mockReturnValue({
      data: { windDown: null },
      loading: false,
      refetch: mockRefetch,
    })
    const { result } = renderStatus()

    act(() => result.current.refresh())

    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it("leaves a read skipped for want of a session alone on refresh", () => {
    mockIsAuthed = false
    const mockRefetch = jest.fn()
    mockUseWindDownQuery.mockReturnValue({
      data: undefined,
      loading: false,
      refetch: mockRefetch,
    })
    const { result } = renderStatus()

    act(() => result.current.refresh())

    expect(mockRefetch).not.toHaveBeenCalled()
  })

  it("keeps the last answer when a refresh fails", async () => {
    const mockRefetch = jest.fn(() => Promise.reject(new Error("network down")))
    mockUseWindDownQuery.mockReturnValue({
      data: { windDown: serverWindDown },
      loading: false,
      refetch: mockRefetch,
    })
    const { result } = renderStatus()

    await act(async () => result.current.refresh())

    expect(result.current.windDown).toMatchObject({ status: WindDownStatus.PreCutoff })
    expect(result.current.isPending).toBe(false)
  })

  it("reads as unaffected and settled outside the provider, with nothing to refresh", () => {
    const { result } = renderHook(() => useWindDownStatus())

    expect(result.current).toMatchObject({ windDown: null, isPending: false })
    expect(() => result.current.refresh()).not.toThrow()
    expect(mockUseWindDownQuery).not.toHaveBeenCalled()
  })
})
