import { renderHook } from "@testing-library/react-native"

import { useWindDownStatus } from "@app/screens/account-migration/hooks/use-wind-down-status"
import { WindDownStatus } from "@app/types/wind-down"

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

describe("useWindDownStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
  })

  it("serves the account's wind-down state, mapped to the domain shape", () => {
    mockUseWindDownQuery.mockReturnValue({
      data: { windDown: serverWindDown },
      loading: false,
    })

    const { result } = renderHook(() => useWindDownStatus())

    const { __typename, ...domainWindDown } = serverWindDown
    expect(result.current.windDown).toEqual(domainWindDown)
    expect(result.current.isPending).toBe(false)
  })

  it("returns null when the wind-down does not affect the account", () => {
    mockUseWindDownQuery.mockReturnValue({ data: { windDown: null }, loading: false })

    const { result } = renderHook(() => useWindDownStatus())

    expect(result.current.windDown).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it("is pending, with no wind-down yet, while the query is still in flight", () => {
    mockUseWindDownQuery.mockReturnValue({ data: undefined, loading: true })

    const { result } = renderHook(() => useWindDownStatus())

    expect(result.current.windDown).toBeNull()
    expect(result.current.isPending).toBe(true)
  })

  it("skips the query and stays null while the user is not authenticated", () => {
    mockIsAuthed = false
    mockUseWindDownQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useWindDownStatus())

    expect(mockUseWindDownQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "no-cache",
    })
    expect(result.current.windDown).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it("fetches without touching the cache so a switch never serves the previous account's status", () => {
    mockUseWindDownQuery.mockReturnValue({ data: { windDown: null } })

    renderHook(() => useWindDownStatus())

    expect(mockUseWindDownQuery).toHaveBeenCalledWith({
      skip: false,
      fetchPolicy: "no-cache",
    })
  })
})
