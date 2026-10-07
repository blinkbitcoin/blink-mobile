import { act, renderHook } from "@testing-library/react-native"

import {
  SwitchProfileOutcome,
  useSwitchToNextProfile,
} from "@app/hooks/use-switch-to-next-profile"

const mockLogout = jest.fn()
const mockSaveToken = jest.fn()
const mockNavigate = jest.fn()
const mockToastShow = jest.fn()
const mockReportError = jest.fn()
const mockReadSessionProfiles = jest.fn()

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

/** Whether the app lock is up when the session dies. The real context pulls in native
 *  boot code this hook never touches, so only the flag is stood in for. */
let mockIsAppLocked = false

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ isAppLocked: mockIsAppLocked }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { ProfileScreen: { switchAccount: () => "Switched" } },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    readSessionProfiles: (...args: unknown[]) => mockReadSessionProfiles(...args),
  },
}))

const storeProfiles = (profiles: unknown[]) => {
  mockReadSessionProfiles.mockResolvedValue({ status: "found", profiles })
}

const profileA = { token: "tok-a", username: "alice", accountId: "acct-a" }
const profileB = { token: "tok-b", username: "bob", accountId: "acct-b" }

describe("useSwitchToNextProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAppLocked = false
    mockLogout.mockResolvedValue(undefined)
    mockSaveToken.mockResolvedValue(undefined)
  })

  it("switches the session behind an unanswered lock without opening the home screen", async () => {
    /** A session can die while the lock screen is the one on show. The home screen
     *  pushed from here would sit on top of it; answering the lock is what lands on
     *  home, on the session this switch left waiting. */
    mockIsAppLocked = true
    storeProfiles([profileA, profileB])

    const { result } = renderHook(() => useSwitchToNextProfile())
    let switchResult
    await act(async () => {
      switchResult = await result.current.switchToNextProfile("tok-a")
    })

    expect(switchResult).toBe(SwitchProfileOutcome.Switched)
    expect(mockSaveToken).toHaveBeenCalledWith("tok-b")
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /**
   * The switch reads the lock long after it started. Backgrounding the app during the
   * token save raises the lock, and a value captured when the switch began still says
   * unlocked: navigating on that one puts this session on top of the lock screen it just
   * raised, with the lock flag still set.
   */
  it("opens no home screen when the lock is raised while the switch is still in flight", async () => {
    storeProfiles([profileA, profileB])

    let resolveSaveToken: () => void = () => {}
    mockSaveToken.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSaveToken = resolve
      }),
    )

    const { result, rerender } = renderHook(() => useSwitchToNextProfile())

    let switchDone: Promise<SwitchProfileOutcome> | undefined
    act(() => {
      switchDone = result.current.switchToNextProfile("tok-a")
    })

    /** The resume relock lands while the save is still pending. */
    mockIsAppLocked = true
    rerender(undefined)

    await act(async () => {
      resolveSaveToken()
      await switchDone
    })

    expect(await switchDone).toBe(SwitchProfileOutcome.Switched)
    expect(mockSaveToken).toHaveBeenCalledWith("tok-b")
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** The mirror has to follow the lock down as well, or a switch after an answered lock
   *  would stop landing on home. */
  it("opens the home screen when the lock is answered while the switch is in flight", async () => {
    mockIsAppLocked = true
    storeProfiles([profileA, profileB])

    let resolveSaveToken: () => void = () => {}
    mockSaveToken.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSaveToken = resolve
      }),
    )

    const { result, rerender } = renderHook(() => useSwitchToNextProfile())

    let switchDone: Promise<SwitchProfileOutcome> | undefined
    act(() => {
      switchDone = result.current.switchToNextProfile("tok-a")
    })

    mockIsAppLocked = false
    rerender(undefined)

    await act(async () => {
      resolveSaveToken()
      await switchDone
    })

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })

  it("deactivates the old token before saving the next profile's token", async () => {
    storeProfiles([profileA, profileB])

    const { result } = renderHook(() => useSwitchToNextProfile())
    let switchResult
    await act(async () => {
      switchResult = await result.current.switchToNextProfile("tok-a")
    })

    expect(switchResult).toBe(SwitchProfileOutcome.Switched)
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
    storeProfiles([profileA])

    const { result } = renderHook(() => useSwitchToNextProfile())
    let switchResult
    await act(async () => {
      switchResult = await result.current.switchToNextProfile("tok-a")
    })

    expect(switchResult).toBe(SwitchProfileOutcome.NoOtherProfile)
    expect(mockLogout).toHaveBeenCalledWith({
      stateToDefault: false,
      token: "tok-a",
      isValidToken: false,
    })
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  // An unreadable store must never reach the caller as "no other profile":
  // callers answer that with a full logout, which erases every saved session.
  it("reports the store as unreadable instead of claiming there is no next profile", async () => {
    mockReadSessionProfiles.mockResolvedValue({
      status: "failed",
      err: new Error("keystore locked"),
    })

    const { result } = renderHook(() => useSwitchToNextProfile())
    let switchResult
    await act(async () => {
      switchResult = await result.current.switchToNextProfile("tok-a")
    })

    expect(switchResult).toBe(SwitchProfileOutcome.ProfilesUnreadable)
    expect(mockReportError).toHaveBeenCalledTimes(1)
    // The dead session still goes, scoped to its own token.
    expect(mockLogout).toHaveBeenCalledWith({
      stateToDefault: false,
      token: "tok-a",
      isValidToken: false,
    })
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("treats an empty store as no next profile", async () => {
    mockReadSessionProfiles.mockResolvedValue({ status: "absent" })

    const { result } = renderHook(() => useSwitchToNextProfile())
    let switchResult
    await act(async () => {
      switchResult = await result.current.switchToNextProfile("tok-a")
    })

    expect(switchResult).toBe(SwitchProfileOutcome.NoOtherProfile)
    expect(mockSaveToken).not.toHaveBeenCalled()
  })
})
