import { act, renderHook } from "@testing-library/react-native"
import { CommonActions, NavigationState } from "@react-navigation/native"

import { useTotpRegistrationFlow } from "@app/screens/totp-screen/hooks/use-totp-registration-flow"

type Route = { key: string; name: string; params?: object }

const mockPop = jest.fn()
const mockDispatch = jest.fn()
/** The stack as the navigator would report it, keys and all. */
let mockRoutes: Route[] = []
/** The key of the screen the hook runs in. */
let mockScreenKey = ""

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    pop: mockPop,
    dispatch: mockDispatch,
    getState: () => ({ routes: mockRoutes }),
  }),
  useRoute: () => ({ key: mockScreenKey }),
}))

const stackOf = (...names: string[]): Route[] =>
  names.map((name, index) => ({ key: `${name}-${index}`, name }))

const BACKUP_PARAMS = { secret: "SECRET", userId: "user-id" }
const BACKUP_ROUTE = { name: "totpRegistrationBackup", params: BACKUP_PARAMS }

/** What the dispatched action does to the stack: the hook hands the navigator a
 *  function of its current state, as the navigator calls it. */
const resetOfStack = () => {
  const buildAction = mockDispatch.mock.calls.at(-1)?.[0]
  const state = { key: "stack", index: mockRoutes.length - 1, routes: mockRoutes }
  return buildAction(state as unknown as NavigationState)
}

/** Runs the hook in the screen of the stack with that name. */
const renderIn = (screenName: string) => {
  mockScreenKey = mockRoutes.find((route) => route.name === screenName)?.key ?? ""
  return renderHook(() => useTotpRegistrationFlow())
}

describe("useTotpRegistrationFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("showBackup", () => {
    it("replaces every registration screen with the backup, keeping the screens below", () => {
      mockRoutes = stackOf(
        "Primary",
        "twoFactorSetup",
        "totpRegistrationIntro",
        "totpRegistrationApps",
        "totpRegistrationInitiate",
        "totpRegistrationValidate",
      )
      const { result } = renderIn("totpRegistrationValidate")

      act(() => result.current.showBackup(BACKUP_PARAMS))

      expect(resetOfStack()).toEqual(
        CommonActions.reset({
          key: "stack",
          index: 2,
          routes: [mockRoutes[0], mockRoutes[1], BACKUP_ROUTE],
        } as unknown as NavigationState),
      )
    })

    /** The app lock goes up over whatever is open on a return from the background,
     *  and the answer to the code can land after it. The key must stay under the lock. */
    it("puts the backup under a screen pushed while the code was checked, which stays on top", () => {
      mockRoutes = stackOf(
        "Primary",
        "totpRegistrationIntro",
        "totpRegistrationValidate",
        "authenticationCheck",
      )
      const { result } = renderIn("totpRegistrationValidate")

      act(() => result.current.showBackup(BACKUP_PARAMS))

      expect(resetOfStack().payload).toMatchObject({
        index: 2,
        routes: [mockRoutes[0], BACKUP_ROUTE, mockRoutes[3]],
      })
    })

    /** Whatever the user went to, another account or the lock, never gets the key
     *  shown over it; the code screen holds the user's ways back while the code is
     *  checked, and the key is in the authenticator app the code came from. */
    it("does nothing once the code screen is gone", () => {
      mockRoutes = stackOf("Primary", "totpRegistrationValidate")
      const { result } = renderIn("totpRegistrationValidate")
      mockRoutes = stackOf("Primary", "settings")

      act(() => result.current.showBackup(BACKUP_PARAMS))

      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe("leave", () => {
    it("pops every registration screen, back to where the registration was started", () => {
      mockRoutes = stackOf(
        "Primary",
        "settings",
        "totpRegistrationBackup",
        "totpRegistrationDone",
      )
      const { result } = renderIn("totpRegistrationDone")

      act(() => result.current.leave())

      expect(mockPop).toHaveBeenCalledWith(2)
    })

    it("pops only the registration at the top, not an earlier one further down", () => {
      mockRoutes = stackOf(
        "Primary",
        "totpRegistrationIntro",
        "twoFactorSetup",
        "totpRegistrationBackup",
        "totpRegistrationDone",
      )
      const { result } = renderIn("totpRegistrationDone")

      act(() => result.current.leave())

      expect(mockPop).toHaveBeenCalledWith(2)
    })
  })

  describe("registrationPrompt", () => {
    it("is the prompt the onboarding was opened from", () => {
      mockRoutes = [
        { key: "Primary-0", name: "Primary" },
        {
          key: "totpRegistrationIntro-1",
          name: "totpRegistrationIntro",
          params: { origin: { prompt: "tier2_bulletin" } },
        },
        { key: "totpRegistrationApps-2", name: "totpRegistrationApps" },
        { key: "totpRegistrationInitiate-3", name: "totpRegistrationInitiate" },
        { key: "totpRegistrationValidate-4", name: "totpRegistrationValidate" },
      ]
      const { result } = renderIn("totpRegistrationValidate")

      expect(result.current.registrationPrompt()).toBe("tier2_bulletin")
    })

    /** The setup hands the onboarding the prompt that opened the setup. */
    it("is the setup's prompt when the setup opened the onboarding", () => {
      mockRoutes = [
        { key: "Primary-0", name: "Primary" },
        { key: "twoFactorSetup-1", name: "twoFactorSetup" },
        {
          key: "totpRegistrationIntro-2",
          name: "totpRegistrationIntro",
          params: { isFromSetup: true, origin: { prompt: "session_modal" } },
        },
        { key: "totpRegistrationValidate-3", name: "totpRegistrationValidate" },
      ]
      const { result } = renderIn("totpRegistrationValidate")

      expect(result.current.registrationPrompt()).toBe("session_modal")
    })

    it("is none for an onboarding opened from the settings, with no prompt", () => {
      mockRoutes = stackOf(
        "Primary",
        "accountScreen",
        "totpRegistrationIntro",
        "totpRegistrationValidate",
      )
      const { result } = renderIn("totpRegistrationValidate")

      expect(result.current.registrationPrompt()).toBeUndefined()
    })

    it("is none for a registration that did not start at the onboarding", () => {
      mockRoutes = stackOf(
        "Primary",
        "totpRegistrationInitiate",
        "totpRegistrationValidate",
      )
      const { result } = renderIn("totpRegistrationValidate")

      expect(result.current.registrationPrompt()).toBeUndefined()
    })
  })

  describe("markStart", () => {
    it("tells the onboarding the registration began at whether it could start", () => {
      mockRoutes = stackOf(
        "Primary",
        "totpRegistrationIntro",
        "totpRegistrationApps",
        "totpRegistrationInitiate",
      )
      const { result } = renderIn("totpRegistrationInitiate")

      act(() => result.current.markStart(true))
      expect(mockDispatch).toHaveBeenLastCalledWith({
        ...CommonActions.setParams({ hasFailedStart: true }),
        source: "totpRegistrationIntro-1",
      })

      act(() => result.current.markStart(false))
      expect(mockDispatch).toHaveBeenLastCalledWith({
        ...CommonActions.setParams({ hasFailedStart: false }),
        source: "totpRegistrationIntro-1",
      })
    })

    /** Opened from the settings, no prompt waits on the registration. */
    it("tells nothing to a registration that did not begin at the onboarding", () => {
      mockRoutes = stackOf("Primary", "accountScreen", "totpRegistrationInitiate")
      const { result } = renderIn("totpRegistrationInitiate")

      act(() => result.current.markStart(true))

      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })
})
