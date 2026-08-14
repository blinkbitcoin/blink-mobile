import { act, renderHook } from "@testing-library/react-native"

import { useSwitchToNextProfile } from "@app/hooks/use-switch-to-next-profile"

const mockLogout = jest.fn()
const mockSaveToken = jest.fn()
const mockNavigate = jest.fn()
const mockToastShow = jest.fn()
const mockGetSessionProfiles = jest.fn()

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

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getSessionProfiles: (...args: unknown[]) => mockGetSessionProfiles(...args),
  },
}))

const profileA = { token: "tok-a", username: "alice", accountId: "acct-a" }
const profileB = { token: "tok-b", username: "bob", accountId: "acct-b" }

describe("useSwitchToNextProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
    mockSaveToken.mockResolvedValue(undefined)
  })

  it("deactivates the old token before saving the next profile's token", async () => {
    mockGetSessionProfiles.mockResolvedValue([profileA, profileB])

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

  it("still deactivates the old session when there is no next profile, but saves nothing", async () => {
    mockGetSessionProfiles.mockResolvedValue([profileA])

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
    expect(mockToastShow).not.toHaveBeenCalled()
  })
})
