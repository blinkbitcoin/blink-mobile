import { renderHook } from "@testing-library/react-native"

import useLogout from "@app/hooks/use-logout"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockClearToken = jest.fn()
const mockResetState = jest.fn()
const mockLogoutMutation = jest.fn()
const mockGetDeviceToken = jest.fn()
const mockAsyncStorage = { multiRemove: jest.fn() }
const mockReportError = jest.fn()

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    resetState: mockResetState,
    clearToken: mockClearToken,
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  useUserLogoutMutation: () => [mockLogoutMutation],
}))

jest.mock("@app/utils/analytics", () => ({
  logLogout: jest.fn(),
}))

jest.mock("@react-native-firebase/messaging", () => () => ({
  getToken: () => mockGetDeviceToken(),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { multiRemove: (...args: unknown[]) => mockAsyncStorage.multiRemove(...args) },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    removeIsBiometricsEnabled: jest.fn(),
    removePin: jest.fn(),
    clearPinFailureState: jest.fn(),
    removeSessionProfiles: jest.fn(),
    removeSessionProfileByToken: jest.fn(),
    getActiveToken: jest.fn(),
  },
}))

const mockedStore = jest.mocked(KeyStoreWrapper)

const logoutOnce = async (
  options?: Parameters<ReturnType<typeof useLogout>["logout"]>[0],
) => {
  const { result } = renderHook(() => useLogout())
  await result.current.logout(options)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedStore.removeIsBiometricsEnabled.mockResolvedValue(true)
  mockedStore.removePin.mockResolvedValue(true)
  mockedStore.clearPinFailureState.mockResolvedValue(true)
  mockedStore.removeSessionProfiles.mockResolvedValue(true)
  mockedStore.getActiveToken.mockResolvedValue("")
  mockGetDeviceToken.mockResolvedValue("")
  mockAsyncStorage.multiRemove.mockResolvedValue(undefined)
  mockLogoutMutation.mockResolvedValue({ data: {} })
})

describe("useLogout", () => {
  it("clears the PIN lockout along with the PIN itself", async () => {
    // A lockout that survives a logout greets the next person to sign in on
    // this device — with a countdown they cannot explain and a spent budget.
    await logoutOnce()

    expect(mockedStore.removePin).toHaveBeenCalledTimes(1)
    expect(mockedStore.clearPinFailureState).toHaveBeenCalledTimes(1)
  })

  it("clears it before the state is reset, so nothing races the teardown", async () => {
    await logoutOnce()

    expect(mockedStore.clearPinFailureState.mock.invocationCallOrder[0]).toBeLessThan(
      mockResetState.mock.invocationCallOrder[0],
    )
  })

  it("erases the saved session profiles by default", async () => {
    await logoutOnce()

    expect(mockedStore.removeSessionProfiles).toHaveBeenCalledTimes(1)
  })

  it("keeps everything the device stored when asked to, and still ends the session", async () => {
    // The caller could not read the store, so the list it would erase is the
    // one it never saw. The PIN goes with it: a live token left behind without
    // the lock that guarded it is worse than either alone. Dropping the schema
    // marker would undo the whole thing, since the next boot would read as a
    // fresh install and sweep the profiles anyway.
    await logoutOnce({ preserveStoredCredentials: true })

    expect(mockedStore.removeSessionProfiles).not.toHaveBeenCalled()
    expect(mockedStore.removePin).not.toHaveBeenCalled()
    expect(mockedStore.removeIsBiometricsEnabled).not.toHaveBeenCalled()
    expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
    expect(mockAsyncStorage.multiRemove).not.toHaveBeenCalled()
    // The active session still ends.
    expect(mockClearToken).toHaveBeenCalledTimes(1)
    expect(mockResetState).toHaveBeenCalledTimes(1)
  })

  it("drops the keychain token when the session signed out is the active one", async () => {
    mockedStore.getActiveToken.mockResolvedValue("active-token")

    await logoutOnce({ token: "active-token" })

    expect(mockClearToken).toHaveBeenCalledTimes(1)
  })

  it("revokes the session server-side when there is a device token to send", async () => {
    mockGetDeviceToken.mockResolvedValue("device-token")

    await logoutOnce({ token: "active-token" })

    expect(mockLogoutMutation).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { input: { deviceToken: "device-token" } } }),
    )
  })

  it("reports a failed device-token fetch and signs out anyway", async () => {
    mockGetDeviceToken.mockRejectedValue(new Error("messaging unavailable"))

    await logoutOnce({ token: "active-token" })

    expect(mockReportError).toHaveBeenCalledWith(
      "logout device token fetch",
      expect.any(Error),
    )
    expect(mockLogoutMutation).not.toHaveBeenCalled()
    expect(mockResetState).toHaveBeenCalledTimes(1)
  })

  it("gives up on a hanging revocation instead of blocking the sign-out", async () => {
    const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {})
    jest.useFakeTimers()
    mockGetDeviceToken.mockResolvedValue("device-token")
    mockLogoutMutation.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useLogout())
    const signOut = result.current.logout({ token: "active-token" })
    await jest.advanceTimersByTimeAsync(2000)
    await signOut

    expect(mockResetState).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
    consoleDebugSpy.mockRestore()
  })

  it("reports a teardown failure and still resets the state", async () => {
    const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {})
    mockedStore.removePin.mockRejectedValue(new Error("keystore locked"))

    await logoutOnce()

    expect(mockReportError).toHaveBeenCalledWith("logout", expect.any(Error))
    expect(mockResetState).toHaveBeenCalledTimes(1)
    consoleDebugSpy.mockRestore()
  })

  it("leaves this device's PIN alone when another session's token is logged out", async () => {
    // The multi-account path drops one stored session; the PIN and its lockout
    // belong to the device, not to that session.
    await logoutOnce({ token: "other-session-token" })

    expect(mockedStore.removeSessionProfileByToken).toHaveBeenCalledWith(
      "other-session-token",
    )
    expect(mockedStore.removePin).not.toHaveBeenCalled()
    expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
  })
})
