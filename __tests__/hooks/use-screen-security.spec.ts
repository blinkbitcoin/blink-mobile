import { renderHook, waitFor } from "@testing-library/react-native"

import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { ScreenSecurityLease } from "@app/utils/screen-security"

const mockAcquireScreenSecurity = jest.fn()
jest.mock("@app/utils/screen-security", () => ({
  acquireScreenSecurity: (...args: readonly unknown[]) =>
    mockAcquireScreenSecurity(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

let themeBlack = "#000000"
jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({
    theme: { colors: { black: themeBlack } },
  }),
}))

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: Error) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const leaseWith = (
  ready: Promise<void>,
): ScreenSecurityLease & { release: jest.Mock } => ({
  ready,
  release: jest.fn(() => Promise.resolve()),
})

describe("useScreenSecurity", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    themeBlack = "#000000"
  })

  it("starts activating and acquires a lease with the theme's background color", () => {
    mockAcquireScreenSecurity.mockReturnValue(leaseWith(new Promise(() => {})))

    const { result } = renderHook(() => useScreenSecurity())

    expect(result.current).toBe("activating")
    expect(mockAcquireScreenSecurity).toHaveBeenCalledWith("#000000")
  })

  it("becomes active once the guard is on", async () => {
    const registration = deferred<void>()
    mockAcquireScreenSecurity.mockReturnValue(leaseWith(registration.promise))

    const { result } = renderHook(() => useScreenSecurity())

    registration.resolve(undefined)
    await waitFor(() => expect(result.current).toBe("active"))
  })

  it("becomes failed and reports when registration is exhausted", async () => {
    const registration = deferred<void>()
    const failure = new Error("native failure")
    mockAcquireScreenSecurity.mockReturnValue(leaseWith(registration.promise))

    const { result } = renderHook(() => useScreenSecurity())

    registration.reject(failure)
    await waitFor(() => expect(result.current).toBe("failed"))
    expect(mockReportError).toHaveBeenCalledWith("Enable screen security", failure)
  })

  it("releases the lease exactly once on unmount", () => {
    const lease = leaseWith(new Promise(() => {}))
    mockAcquireScreenSecurity.mockReturnValue(lease)

    const { unmount } = renderHook(() => useScreenSecurity())
    unmount()

    expect(lease.release).toHaveBeenCalledTimes(1)
  })

  it("ignores a late settlement arriving after unmount", async () => {
    const registration = deferred<void>()
    mockAcquireScreenSecurity.mockReturnValue(leaseWith(registration.promise))

    const { result, unmount } = renderHook(() => useScreenSecurity())
    unmount()

    registration.resolve(undefined)
    await Promise.resolve()

    expect(result.current).toBe("activating")
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("reports a rejected release on unmount", async () => {
    const failure = new Error("native failure")
    const lease = leaseWith(new Promise(() => {}))
    lease.release.mockRejectedValue(failure)
    mockAcquireScreenSecurity.mockReturnValue(lease)

    const { unmount } = renderHook(() => useScreenSecurity())
    unmount()

    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith("Disable screen security", failure),
    )
  })

  /** A theme flip re-runs the effect: the old lease is released and the guard
   *  drops before the fresh registration lands. The state must fall back to
   *  "activating" for that window so the gate re-hides the content. */
  it("re-gates while re-acquiring after the background color changes", async () => {
    const first = deferred<void>()
    const firstLease = leaseWith(first.promise)
    mockAcquireScreenSecurity.mockReturnValue(firstLease)

    const { result, rerender } = renderHook(() => useScreenSecurity())
    first.resolve(undefined)
    await waitFor(() => expect(result.current).toBe("active"))

    const second = deferred<void>()
    mockAcquireScreenSecurity.mockReturnValue(leaseWith(second.promise))
    themeBlack = "#111111"
    rerender({})

    await waitFor(() => expect(result.current).toBe("activating"))
    expect(firstLease.release).toHaveBeenCalledTimes(1)
    expect(mockAcquireScreenSecurity).toHaveBeenCalledWith("#111111")

    second.resolve(undefined)
    await waitFor(() => expect(result.current).toBe("active"))
  })
})
