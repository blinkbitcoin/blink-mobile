import { renderHook } from "@testing-library/react-native"

import useLogout from "@app/hooks/use-logout"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockClearToken = jest.fn()
const mockResetState = jest.fn()
const mockLogoutMutation = jest.fn()

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

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { multiRemove: jest.fn().mockResolvedValue(undefined) },
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
