import { renderHook, act } from "@testing-library/react-native"

import { SCHEMA_VERSION_KEY } from "@app/config"
import useLogout from "@app/hooks/use-logout"

const mockResetState = jest.fn()
const mockUserLogoutMutation = jest.fn()
const mockMultiRemove = jest.fn()
const mockGetDeviceToken = jest.fn()
const mockReportError = jest.fn()

// In-memory stand-in for the secure key store: the assertions below run
// against the real KeyStoreWrapper, so the profile/active-token interplay is
// exercised end to end rather than through mocked wrapper methods.
const mockSecureStore = new Map<string, string>()
const failRemoveFor = new Set<string>()
jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: (key: string) =>
      mockSecureStore.has(key)
        ? Promise.resolve(mockSecureStore.get(key))
        : Promise.reject(new Error(`key not found: ${key}`)),
    set: (key: string, value: string) => {
      mockSecureStore.set(key, value)
      return Promise.resolve(true)
    },
    remove: (key: string) => {
      if (failRemoveFor.has(key)) return Promise.reject(new Error("keystore locked"))
      mockSecureStore.delete(key)
      return Promise.resolve(true)
    },
  },
  ACCESSIBLE: {
    ALWAYS_THIS_DEVICE_ONLY: "ALWAYS_THIS_DEVICE_ONLY",
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  },
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  multiRemove: (...args: unknown[]) => mockMultiRemove(...args),
}))

jest.mock("@react-native-firebase/messaging", () => () => ({
  getToken: () => mockGetDeviceToken(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ resetState: mockResetState }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserLogoutMutation: () => [mockUserLogoutMutation],
}))

jest.mock("@app/utils/analytics", () => ({ logLogout: jest.fn() }))
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const profileA = { token: "tok-a", username: "alice", accountId: "acct-a" }
const profileB = { token: "tok-b", username: "bob", accountId: "acct-b" }

const seedProfiles = (profiles: { token: string }[]) =>
  mockSecureStore.set("sessionProfiles", JSON.stringify(profiles))

const storedProfiles = (): { token: string }[] =>
  JSON.parse(mockSecureStore.get("sessionProfiles") ?? "[]")

describe("useLogout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSecureStore.clear()
    failRemoveFor.clear()
    mockUserLogoutMutation.mockResolvedValue({ data: { userLogout: { success: true } } })
    mockMultiRemove.mockResolvedValue(undefined)
    mockGetDeviceToken.mockResolvedValue("device-token")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("full logout clears the active token and all profiles from the key store", async () => {
    mockSecureStore.set("activeAuthToken", "tok-a")
    seedProfiles([profileA, profileB])

    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout()
    })

    expect(mockSecureStore.has("activeAuthToken")).toBe(false)
    expect(mockSecureStore.has("sessionProfiles")).toBe(false)
    expect(mockResetState).toHaveBeenCalled()
  })

  it("full logout also wipes PIN, biometrics and the schema version key, without calling the server mutation", async () => {
    mockSecureStore.set("PIN", "1234")
    mockSecureStore.set("pinAttempts", "3")
    mockSecureStore.set("isBiometricsEnabled", "1")
    mockSecureStore.set("activeAuthToken", "tok-a")
    seedProfiles([profileA])

    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout()
    })

    expect(mockSecureStore.has("PIN")).toBe(false)
    expect(mockSecureStore.has("pinAttempts")).toBe(false)
    expect(mockSecureStore.has("isBiometricsEnabled")).toBe(false)
    expect(mockMultiRemove).toHaveBeenCalledWith([SCHEMA_VERSION_KEY])
    // No token context means there is nothing to revoke server-side.
    expect(mockUserLogoutMutation).not.toHaveBeenCalled()
  })

  it("full logout with stateToDefault: false keeps the in-memory state", async () => {
    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout({ stateToDefault: false })
    })

    expect(mockResetState).not.toHaveBeenCalled()
  })

  it("removing the profile backing the active session clears the active token", async () => {
    mockSecureStore.set("activeAuthToken", "tok-a")
    seedProfiles([profileA, profileB])

    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout({ stateToDefault: false, token: "tok-a" })
    })

    // Regression: the deleted profile's token must not linger as the active
    // token — it would otherwise be hydrated back into memory on next launch.
    expect(mockSecureStore.has("activeAuthToken")).toBe(false)
    expect(storedProfiles().map((p) => p.token)).toEqual(["tok-b"])
    expect(mockResetState).not.toHaveBeenCalled()
    expect(mockUserLogoutMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { headers: { authorization: "Bearer tok-a" } },
      }),
    )
  })

  it("removing an inactive profile keeps the active token untouched", async () => {
    mockSecureStore.set("activeAuthToken", "tok-b")
    seedProfiles([profileA, profileB])

    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout({ stateToDefault: false, token: "tok-a" })
    })

    expect(mockSecureStore.get("activeAuthToken")).toBe("tok-b")
    expect(storedProfiles().map((p) => p.token)).toEqual(["tok-b"])
  })

  it("isValidToken: false skips the server revocation but still cleans up locally", async () => {
    mockSecureStore.set("activeAuthToken", "tok-a")
    seedProfiles([profileA, profileB])

    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout({
        stateToDefault: false,
        token: "tok-a",
        isValidToken: false,
      })
    })

    expect(mockUserLogoutMutation).not.toHaveBeenCalled()
    expect(mockSecureStore.has("activeAuthToken")).toBe(false)
    expect(storedProfiles().map((p) => p.token)).toEqual(["tok-b"])
  })

  it("still clears the active token when the server-side revocation fails", async () => {
    mockSecureStore.set("activeAuthToken", "tok-a")
    seedProfiles([profileA, profileB])
    mockUserLogoutMutation.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout({ stateToDefault: false, token: "tok-a" })
    })

    expect(mockSecureStore.has("activeAuthToken")).toBe(false)
    expect(storedProfiles().map((p) => p.token)).toEqual(["tok-b"])
  })

  it("completes via the timeout when the revocation mutation hangs", async () => {
    mockSecureStore.set("activeAuthToken", "tok-a")
    seedProfiles([profileA])
    mockUserLogoutMutation.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useLogout())

    // Fire the logout timeout immediately instead of faking all timers, which
    // would freeze React's scheduler and hang the renderer.
    const setTimeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((
      cb: () => void,
    ) => {
      cb()
      return 0
    }) as unknown as typeof setTimeout)

    await act(async () => {
      await result.current.logout({ token: "tok-a" })
    })
    setTimeoutSpy.mockRestore()

    expect(mockReportError).toHaveBeenCalled()
    expect(mockResetState).toHaveBeenCalled()
  })

  it("a keystore removal failure does not abort the logout or the state reset", async () => {
    mockSecureStore.set("activeAuthToken", "tok-a")
    seedProfiles([profileA])
    failRemoveFor.add("activeAuthToken")

    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout({ token: "tok-a" })
    })

    // The removal failed, so the key survives — but the logout flow itself
    // must not blow up, and the in-memory state is still reset.
    expect(mockSecureStore.has("activeAuthToken")).toBe(true)
    expect(mockResetState).toHaveBeenCalled()
  })

  it("resets state even when fetching the push device token fails", async () => {
    mockGetDeviceToken.mockRejectedValue(new Error("fcm unavailable"))

    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current.logout()
    })

    expect(mockReportError).toHaveBeenCalled()
    expect(mockResetState).toHaveBeenCalled()
  })
})
