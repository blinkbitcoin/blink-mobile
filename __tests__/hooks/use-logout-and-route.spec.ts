import { act, renderHook } from "@testing-library/react-native"

import { useLogoutAndRoute } from "@app/hooks/use-logout-and-route"

const mockLogout = jest.fn()
const mockReturnToGate = jest.fn()
const mockSetAppUnlocked = jest.fn()
const mockReset = jest.fn()

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/hooks/use-return-to-gate", () => ({
  useReturnToGate: () => mockReturnToGate,
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ reset: mockReset }),
}))

const GET_STARTED_RESET = { index: 0, routes: [{ name: "getStarted" }] }

describe("useLogoutAndRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogout.mockResolvedValue({ isAppLockKept: false })
  })

  describe("logoutAndRoute", () => {
    /**
     * The hole this closes: the landing screen opens an account, and any account lists
     * every wallet the device stores, so a lock the logout kept has to be answered first.
     */
    it("returns through the gate when the logout kept the lock", async () => {
      mockLogout.mockResolvedValue({ isAppLockKept: true })
      const { result } = renderHook(() => useLogoutAndRoute())

      await act(async () => {
        await result.current.logoutAndRoute()
      })

      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
      expect(mockReset).not.toHaveBeenCalled()
      expect(mockSetAppUnlocked).not.toHaveBeenCalled()
    })

    it("lands on the landing screen once the lock is gone", async () => {
      mockLogout.mockResolvedValue({ isAppLockKept: false })
      const { result } = renderHook(() => useLogoutAndRoute())

      await act(async () => {
        await result.current.logoutAndRoute()
      })

      expect(mockReset).toHaveBeenCalledWith(GET_STARTED_RESET)
      expect(mockReturnToGate).not.toHaveBeenCalled()
    })

    /** Left up, the app would never relock on resume and every payment link would stay
     *  parked behind a lock that is no longer there. */
    it("drops the lock flag with the lock itself", async () => {
      mockLogout.mockResolvedValue({ isAppLockKept: false })
      const { result } = renderHook(() => useLogoutAndRoute())

      await act(async () => {
        await result.current.logoutAndRoute()
      })

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      const unlockOrder = mockSetAppUnlocked.mock.invocationCallOrder[0]
      const resetOrder = mockReset.mock.invocationCallOrder[0]
      expect(unlockOrder).toBeLessThan(resetOrder)
    })

    it("hands the caller's options to the logout untouched", async () => {
      const { result } = renderHook(() => useLogoutAndRoute())

      await act(async () => {
        await result.current.logoutAndRoute({ preserveStoredCredentials: true })
      })

      expect(mockLogout).toHaveBeenCalledWith({ preserveStoredCredentials: true })
    })

    it("routes only after the logout has finished", async () => {
      let resolveLogout: (result: { isAppLockKept: boolean }) => void = () => {}
      mockLogout.mockReturnValue(
        new Promise<{ isAppLockKept: boolean }>((resolve) => {
          resolveLogout = resolve
        }),
      )
      const { result } = renderHook(() => useLogoutAndRoute())

      let routed: Promise<void> | undefined
      act(() => {
        routed = result.current.logoutAndRoute()
      })
      expect(mockReturnToGate).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()

      await act(async () => {
        resolveLogout({ isAppLockKept: true })
        await routed
      })

      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
    })
  })

  describe("routeAfterLogout", () => {
    /** For the caller that routes from inside a dialog's callback and has to carry the
     *  answer there rather than act on it when the logout returns. */
    it("returns through the gate for a kept lock", () => {
      const { result } = renderHook(() => useLogoutAndRoute())

      act(() => {
        result.current.routeAfterLogout(true)
      })

      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
      expect(mockReset).not.toHaveBeenCalled()
    })

    it("lands on the landing screen for a lock that went", () => {
      const { result } = renderHook(() => useLogoutAndRoute())

      act(() => {
        result.current.routeAfterLogout(false)
      })

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(mockReset).toHaveBeenCalledWith(GET_STARTED_RESET)
      expect(mockReturnToGate).not.toHaveBeenCalled()
    })

    it("runs no logout of its own", () => {
      const { result } = renderHook(() => useLogoutAndRoute())

      act(() => {
        result.current.routeAfterLogout(true)
      })

      expect(mockLogout).not.toHaveBeenCalled()
    })
  })
})
