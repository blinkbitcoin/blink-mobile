import { act, renderHook } from "@testing-library/react-native"

import useLogout from "@app/hooks/use-logout"

const mockUserLogoutMutation = jest.fn()
const mockResetState = jest.fn()
const mockLogLogout = jest.fn()
const mockReportError = jest.fn()
const mockGetDeviceToken = jest.fn()

const mockRemoveIsBiometricsEnabled = jest.fn()
const mockRemovePin = jest.fn()
const mockRemovePinAttempts = jest.fn()
const mockRemoveSessionProfiles = jest.fn()
const mockRemoveSessionProfileByToken = jest.fn()
const mockGetActiveToken = jest.fn()
const mockRemoveActiveToken = jest.fn()
const mockClearToken = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserLogoutMutation: () => [mockUserLogoutMutation],
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    resetState: mockResetState,
    clearToken: (...args: unknown[]) => mockClearToken(...args),
  }),
}))

jest.mock("@app/utils/analytics", () => ({
  logLogout: (...args: unknown[]) => mockLogLogout(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@react-native-firebase/messaging", () => () => ({
  getToken: () => mockGetDeviceToken(),
}))

const mockMultiRemove = jest.fn()
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    multiRemove: (...args: unknown[]) => mockMultiRemove(...args),
  },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    removeIsBiometricsEnabled: (...args: unknown[]) =>
      mockRemoveIsBiometricsEnabled(...args),
    removePin: (...args: unknown[]) => mockRemovePin(...args),
    removePinAttempts: (...args: unknown[]) => mockRemovePinAttempts(...args),
    removeSessionProfiles: (...args: unknown[]) => mockRemoveSessionProfiles(...args),
    removeSessionProfileByToken: (...args: unknown[]) =>
      mockRemoveSessionProfileByToken(...args),
    getActiveToken: (...args: unknown[]) => mockGetActiveToken(...args),
    removeActiveToken: (...args: unknown[]) => mockRemoveActiveToken(...args),
  },
}))

describe("useLogout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserLogoutMutation.mockResolvedValue({ data: { userLogout: { success: true } } })
    mockGetDeviceToken.mockResolvedValue("device-token")
    mockMultiRemove.mockResolvedValue(undefined)
    mockRemoveIsBiometricsEnabled.mockResolvedValue(true)
    mockRemovePin.mockResolvedValue(true)
    mockRemovePinAttempts.mockResolvedValue(true)
    mockRemoveSessionProfiles.mockResolvedValue(true)
    mockRemoveSessionProfileByToken.mockResolvedValue(true)
    mockGetActiveToken.mockResolvedValue("")
    mockRemoveActiveToken.mockResolvedValue(true)
    mockClearToken.mockResolvedValue(undefined)
  })

  it("full logout removes the active token from the keychain alongside the other secrets", async () => {
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout()
    })

    expect(mockRemoveIsBiometricsEnabled).toHaveBeenCalledTimes(1)
    expect(mockRemovePin).toHaveBeenCalledTimes(1)
    expect(mockRemovePinAttempts).toHaveBeenCalledTimes(1)
    expect(mockRemoveSessionProfiles).toHaveBeenCalledTimes(1)
    // Through the provider, never straight at the keystore: the provider owns
    // the slot and the ref that tracks what it durably holds.
    expect(mockClearToken).toHaveBeenCalledTimes(1)
    expect(mockRemoveActiveToken).not.toHaveBeenCalled()
    expect(mockResetState).toHaveBeenCalledTimes(1)
  })

  it("preserves the PIN when the caller asks to (a lockout-triggered logout)", async () => {
    // A logout forced by exhausting PIN attempts must not delete the very
    // lock it is enforcing: getIsPinEnabled() is just "is a PIN stored", so
    // removing it here would leave the next screen ungated. Everything else
    // "logout" wipes (session, biometrics, device state) still applies.
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout({ preservePin: true })
    })

    expect(mockRemovePin).not.toHaveBeenCalled()
    expect(mockRemoveIsBiometricsEnabled).toHaveBeenCalledTimes(1)
    expect(mockRemovePinAttempts).toHaveBeenCalledTimes(1)
    expect(mockRemoveSessionProfiles).toHaveBeenCalledTimes(1)
    expect(mockClearToken).toHaveBeenCalledTimes(1)
    expect(mockResetState).toHaveBeenCalledTimes(1)
  })

  it("profile logout (explicit token) removes only that profile, not the active keychain token", async () => {
    mockGetActiveToken.mockResolvedValue("current-session-token")
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout({
        token: "other-profile-token",
        isValidToken: false,
        stateToDefault: false,
      })
    })

    expect(mockRemoveSessionProfileByToken).toHaveBeenCalledWith("other-profile-token")
    expect(mockClearToken).not.toHaveBeenCalled()
    expect(mockRemoveActiveToken).not.toHaveBeenCalled()
    expect(mockResetState).not.toHaveBeenCalled()
  })

  it("profile logout also drops the keychain token when the removed profile backs the active session", async () => {
    // A crash after this logout but before the caller saves the next token
    // must land on "logged out", never on a session whose profile is gone.
    mockGetActiveToken.mockResolvedValue("active-token")
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout({
        token: "active-token",
        isValidToken: false,
        stateToDefault: false,
      })
    })

    expect(mockRemoveSessionProfileByToken).toHaveBeenCalledWith("active-token")
    expect(mockClearToken).toHaveBeenCalledTimes(1)
    expect(mockRemoveActiveToken).not.toHaveBeenCalled()
  })

  it("revokes the session server-side when a valid token and device token are available", async () => {
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout({ token: "session-token", stateToDefault: false })
    })

    expect(mockUserLogoutMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { deviceToken: "device-token" } },
      }),
    )
  })

  it("a failed device-token fetch never skips the local cleanup, only the server revocation", async () => {
    mockGetDeviceToken.mockRejectedValue(new Error("firebase unavailable"))
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout({ token: "session-token", stateToDefault: false })
    })

    expect(mockRemoveSessionProfileByToken).toHaveBeenCalledWith("session-token")
    // UserLogoutInput.deviceToken is non-null: without one there is no valid
    // revocation call to make.
    expect(mockUserLogoutMutation).not.toHaveBeenCalled()
    expect(mockReportError).toHaveBeenCalledWith(
      "logout device token fetch",
      expect.any(Error),
    )
  })

  it("a failed device-token fetch on full logout still wipes every keychain secret", async () => {
    mockGetDeviceToken.mockRejectedValue(new Error("firebase unavailable"))
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout()
    })

    expect(mockRemoveIsBiometricsEnabled).toHaveBeenCalledTimes(1)
    expect(mockRemovePin).toHaveBeenCalledTimes(1)
    expect(mockRemovePinAttempts).toHaveBeenCalledTimes(1)
    expect(mockRemoveSessionProfiles).toHaveBeenCalledTimes(1)
    // Through the provider, never straight at the keystore: the provider owns
    // the slot and the ref that tracks what it durably holds.
    expect(mockClearToken).toHaveBeenCalledTimes(1)
    expect(mockRemoveActiveToken).not.toHaveBeenCalled()
    expect(mockResetState).toHaveBeenCalledTimes(1)
  })
})
