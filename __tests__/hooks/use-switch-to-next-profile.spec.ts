import { renderHook, act } from "@testing-library/react-native"

import { useSwitchToNextProfile } from "@app/hooks/use-switch-to-next-profile"

const mockLogout = jest.fn()
const mockSaveToken = jest.fn()
const mockNavigate = jest.fn()
const mockToastShow = jest.fn()

// Real KeyStoreWrapper over an in-memory key store, so the profile lookup is
// exercised rather than stubbed.
const mockSecureStore = new Map<string, string>()
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
      mockSecureStore.delete(key)
      return Promise.resolve(true)
    },
  },
  ACCESSIBLE: {
    ALWAYS_THIS_DEVICE_ONLY: "ALWAYS_THIS_DEVICE_ONLY",
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  },
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ saveToken: mockSaveToken }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { ProfileScreen: { switchAccount: () => "Switched" } },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const profileA = { token: "tok-a", username: "alice", accountId: "acct-a" }
const profileB = { token: "tok-b", username: "bob", accountId: "acct-b" }

describe("useSwitchToNextProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSecureStore.clear()
    mockLogout.mockResolvedValue(undefined)
    mockSaveToken.mockResolvedValue(undefined)
  })

  it("deactivates the old token before saving the next profile's token", async () => {
    mockSecureStore.set("sessionProfiles", JSON.stringify([profileA, profileB]))

    const { result } = renderHook(() => useSwitchToNextProfile())
    let nextProfile
    await act(async () => {
      nextProfile = await result.current.switchToNextProfile("tok-a")
    })

    expect(nextProfile).toEqual(profileB)
    // No server revocation for a session the caller has already invalidated.
    expect(mockLogout).toHaveBeenCalledWith({
      stateToDefault: false,
      token: "tok-a",
      isValidToken: false,
    })
    expect(mockSaveToken).toHaveBeenCalledWith("tok-b")
    // Ordering is the invariant: the old active token must be cleared before
    // (or as) the new one is saved — never the other way round.
    expect(mockLogout.mock.invocationCallOrder[0]).toBeLessThan(
      mockSaveToken.mock.invocationCallOrder[0],
    )
    expect(mockNavigate).toHaveBeenCalledWith("Primary")
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("does not touch the active token when there is no next profile", async () => {
    mockSecureStore.set("sessionProfiles", JSON.stringify([profileA]))

    const { result } = renderHook(() => useSwitchToNextProfile())
    let nextProfile
    await act(async () => {
      nextProfile = await result.current.switchToNextProfile("tok-a")
    })

    expect(nextProfile).toBeUndefined()
    expect(mockLogout).toHaveBeenCalledWith({
      stateToDefault: false,
      token: "tok-a",
      isValidToken: false,
    })
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
