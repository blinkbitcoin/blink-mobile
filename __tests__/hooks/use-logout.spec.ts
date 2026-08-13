import { act, renderHook } from "@testing-library/react-native"

import useLogout from "@app/hooks/use-logout"

const mockUserLogoutMutation = jest.fn()
const mockResetState = jest.fn()
const mockLogLogout = jest.fn()
const mockReportError = jest.fn()

const mockRemoveIsBiometricsEnabled = jest.fn()
const mockRemovePin = jest.fn()
const mockRemovePinAttempts = jest.fn()
const mockRemoveSessionProfiles = jest.fn()
const mockRemoveSessionProfileByToken = jest.fn()
const mockRemoveActiveToken = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserLogoutMutation: () => [mockUserLogoutMutation],
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ resetState: mockResetState }),
}))

jest.mock("@app/utils/analytics", () => ({
  logLogout: (...args: unknown[]) => mockLogLogout(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@react-native-firebase/messaging", () => () => ({
  getToken: () => Promise.resolve("device-token"),
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
    removeActiveToken: (...args: unknown[]) => mockRemoveActiveToken(...args),
  },
}))

describe("useLogout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserLogoutMutation.mockResolvedValue({ data: { userLogout: { success: true } } })
    mockMultiRemove.mockResolvedValue(undefined)
    mockRemoveIsBiometricsEnabled.mockResolvedValue(true)
    mockRemovePin.mockResolvedValue(true)
    mockRemovePinAttempts.mockResolvedValue(true)
    mockRemoveSessionProfiles.mockResolvedValue(true)
    mockRemoveSessionProfileByToken.mockResolvedValue(true)
    mockRemoveActiveToken.mockResolvedValue(true)
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
    expect(mockRemoveActiveToken).toHaveBeenCalledTimes(1)
    expect(mockResetState).toHaveBeenCalledTimes(1)
  })

  it("profile logout (explicit token) removes only that profile, not the active keychain token", async () => {
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout({
        token: "other-profile-token",
        isValidToken: false,
        stateToDefault: false,
      })
    })

    expect(mockRemoveSessionProfileByToken).toHaveBeenCalledWith("other-profile-token")
    expect(mockRemoveActiveToken).not.toHaveBeenCalled()
    expect(mockResetState).not.toHaveBeenCalled()
  })
})
