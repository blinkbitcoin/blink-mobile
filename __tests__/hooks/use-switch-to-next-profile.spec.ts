import { act, renderHook } from "@testing-library/react-native"
import { it } from "@jest/globals"

import {
  SwitchProfileOutcome,
  useSwitchToNextProfile,
} from "@app/hooks/use-switch-to-next-profile"

const mockLogout = jest.fn()
const mockSaveToken = jest.fn()
const mockNavigate = jest.fn()
const mockPopTo = jest.fn()
const mockToastShow = jest.fn()
const mockReportError = jest.fn()
const mockReadSessionProfiles = jest.fn()
const mockReturnToGate = jest.fn()

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/hooks/use-return-to-gate", () => ({
  useReturnToGate: () => mockReturnToGate,
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ saveToken: mockSaveToken }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, popTo: mockPopTo }),
}))

/** Whether the app lock is up when the session dies. The real context pulls in native
 *  boot code this hook never touches, so only the flag is stood in for. */
let mockIsAppLocked = false

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  /** The lock's own synchronous read, which answers at once rather than a commit later:
   *  that is the whole point of the switch asking it after its awaits. */
  useAuthenticationContext: () => ({ readIsAppLocked: () => mockIsAppLocked }),
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

  it("switches the session behind an unanswered lock and sends the whole stack back to the gate", async () => {
    /** A session can die while the lock screen is the one on show. The screens under
     *  the lock belong to the dead session, and a resume unlock would step back onto
     *  them under the new token, so nothing of them may be left: the gate asks again
     *  from a cold start, and answering it lands on home for the new session. */
    mockIsAppLocked = true
    storeProfiles([profileA, profileB])

    const { result } = renderHook(() => useSwitchToNextProfile())
    let switchResult
    await act(async () => {
      switchResult = await result.current.switchToNextProfile("tok-a")
    })

    expect(switchResult).toBe(SwitchProfileOutcome.Switched)
    expect(mockSaveToken).toHaveBeenCalledWith("tok-b")
    expect(mockPopTo).not.toHaveBeenCalled()
    expect(mockReturnToGate).toHaveBeenCalledTimes(1)
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

    const { result } = renderHook(() => useSwitchToNextProfile())

    let switchDone: Promise<SwitchProfileOutcome> | undefined
    act(() => {
      switchDone = result.current.switchToNextProfile("tok-a")
    })

    /** The resume relock lands while the save is still pending. No rerender: the lock's
     *  own ref answers at once, which is what a mirror of it could not promise. */
    mockIsAppLocked = true

    await act(async () => {
      resolveSaveToken()
      await switchDone
    })

    expect(await switchDone).toBe(SwitchProfileOutcome.Switched)
    expect(mockSaveToken).toHaveBeenCalledWith("tok-b")
    expect(mockPopTo).not.toHaveBeenCalled()
    expect(mockReturnToGate).toHaveBeenCalledTimes(1)
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

    const { result } = renderHook(() => useSwitchToNextProfile())

    let switchDone: Promise<SwitchProfileOutcome> | undefined
    act(() => {
      switchDone = result.current.switchToNextProfile("tok-a")
    })

    mockIsAppLocked = false

    await act(async () => {
      resolveSaveToken()
      await switchDone
    })

    expect(mockPopTo).toHaveBeenCalledWith("Primary")
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockReturnToGate).not.toHaveBeenCalled()
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
    expect(mockPopTo).toHaveBeenCalledWith("Primary")
    expect(mockNavigate).not.toHaveBeenCalled()
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
    expect(mockPopTo).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  /** A screen that refuses to be left while it works lets only its own navigation
   *  through; the switch's way home has to be handed to it rather than run around it. */
  it.each([
    { locked: false, expectedCall: "popTo" },
    { locked: true, expectedCall: "returnToGate" },
  ])("leaves through the caller's own way out (%j)", async ({ locked, expectedCall }) => {
    mockIsAppLocked = locked
    storeProfiles([profileA, profileB])
    const leave = jest.fn()

    const { result } = renderHook(() => useSwitchToNextProfile())
    await act(async () => {
      await result.current.switchToNextProfile("tok-a", leave)
    })

    expect(leave).toHaveBeenCalledTimes(1)
    expect(mockPopTo).not.toHaveBeenCalled()
    expect(mockReturnToGate).not.toHaveBeenCalled()

    leave.mock.calls[0][0]()
    if (expectedCall === "popTo") {
      expect(mockPopTo).toHaveBeenCalledWith("Primary")
    } else {
      expect(mockReturnToGate).toHaveBeenCalledTimes(1)
    }
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
    expect(mockPopTo).not.toHaveBeenCalled()
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
