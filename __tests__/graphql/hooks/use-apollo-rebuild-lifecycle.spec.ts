import { renderHook, act } from "@testing-library/react-native"

const mockCrashlyticsLog = jest.fn()
const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: unknown[]) => mockCrashlyticsLog(...args),
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

import { useApolloRebuildLifecycle } from "@app/graphql/hooks/use-apollo-rebuild-lifecycle"

const buildClient = (id: string, stop: () => void = jest.fn()) => ({ id, stop }) as never

describe("useApolloRebuildLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does nothing on first mount — there is no previous client to clean up", () => {
    renderHook(() => useApolloRebuildLifecycle("token-a"))

    expect(mockCrashlyticsLog).not.toHaveBeenCalled()
  })

  it("records a breadcrumb and stops the registered client when the token changes", () => {
    const stop = jest.fn()
    const clientA = buildClient("a", stop)

    const { result, rerender } = renderHook(
      ({ token }: { token: string }) => useApolloRebuildLifecycle(token),
      { initialProps: { token: "token-a" } },
    )

    act(() => {
      result.current.registerActiveClient(clientA)
    })

    rerender({ token: "token-b" })

    expect(stop).toHaveBeenCalledTimes(1)
    expect(mockCrashlyticsLog).toHaveBeenCalledWith(
      "Apollo client rebuild: token present=true",
    )
  })

  it("reports token-present=false when the rebuild strips the token (e.g. logout, switch to self-custodial)", () => {
    const clientA = buildClient("a")

    const { result, rerender } = renderHook(
      ({ token }: { token: string }) => useApolloRebuildLifecycle(token),
      { initialProps: { token: "token-a" } },
    )

    act(() => {
      result.current.registerActiveClient(clientA)
    })

    rerender({ token: "" })

    expect(mockCrashlyticsLog).toHaveBeenCalledWith(
      "Apollo client rebuild: token present=false",
    )
  })

  it("swallows failures from stop() and reports them so the new client's construction is never blocked", () => {
    const stopError = new Error("link teardown failed")
    const throwingClient = buildClient("a", () => {
      throw stopError
    })

    const { result, rerender } = renderHook(
      ({ token }: { token: string }) => useApolloRebuildLifecycle(token),
      { initialProps: { token: "token-a" } },
    )

    act(() => {
      result.current.registerActiveClient(throwingClient)
    })

    expect(() => rerender({ token: "token-b" })).not.toThrow()
    expect(mockRecordError).toHaveBeenCalledWith(stopError)
  })

  it("does not re-run on identical token across renders — no spurious rebuild log", () => {
    const clientA = buildClient("a")

    const { result, rerender } = renderHook(
      ({ token }: { token: string }) => useApolloRebuildLifecycle(token),
      { initialProps: { token: "token-a" } },
    )

    act(() => {
      result.current.registerActiveClient(clientA)
    })

    rerender({ token: "token-a" })
    rerender({ token: "token-a" })

    expect(mockCrashlyticsLog).not.toHaveBeenCalled()
  })

  it("exposes a stable registerActiveClient callback identity so it can be safely listed in caller deps", () => {
    const { result, rerender } = renderHook(
      ({ token }: { token: string }) => useApolloRebuildLifecycle(token),
      { initialProps: { token: "token-a" } },
    )

    const first = result.current.registerActiveClient
    rerender({ token: "token-b" })
    rerender({ token: "token-c" })
    const last = result.current.registerActiveClient

    expect(last).toBe(first)
  })
})
