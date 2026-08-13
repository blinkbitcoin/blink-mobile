jest.mock("react-native-bootsplash", () => ({
  __esModule: true,
  default: { hide: jest.fn() },
}))

jest.mock("@react-native-firebase/analytics", () => () => ({
  logScreenView: jest.fn(),
}))

jest.mock("@react-native-firebase/app-check", () => ({
  __esModule: true,
  default: () => ({
    newReactNativeFirebaseAppCheckProvider: () => ({ configure: jest.fn() }),
    initializeAppCheck: jest.fn(),
  }),
}))

jest.mock("@app/components/upgrade-account-modal", () => ({
  __esModule: true,
  UpgradeAccountModal: () => null,
}))

const mockReset = jest.fn()
let mockBlockerVisible = false
let mockIsReady = true
let mockRootState:
  | { index: number; routes: { name: string; params?: object }[] }
  | undefined
let mockOnReady: (() => void) | undefined
let mockOnStateChange: ((state: unknown) => void) | undefined

/** The navigationRef is module-level, so the container ref is stubbed. The stub APPLIES the
 *  reset to the stack it serves, as the real container does, so a second evaluation sees the
 *  popped stack rather than the one that prompted the pop. The container itself renders its
 *  children and hands onReady to the test, which fires it where the app would. */
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  createNavigationContainerRef: () => ({
    reset: (state: { routes: { name: string }[] }) => {
      mockReset(state)
      mockRootState = { index: 0, routes: state.routes }
    },
    isReady: () => mockIsReady,
    getRootState: () => mockRootState,
  }),
  NavigationContainer: ({
    children,
    onReady,
    onStateChange,
  }: {
    children?: React.ReactNode
    onReady?: () => void
    onStateChange?: (state: unknown) => void
  }) => {
    mockOnReady = onReady
    mockOnStateChange = onStateChange
    return children ?? null
  },
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-blocker", () => ({
  useMigrationBlocker: () => ({ isVisible: mockBlockerVisible }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isSelfCustodial: false }),
}))

jest.mock("@app/components/actions", () => ({
  ...jest.requireActual("@app/components/actions"),
  useActionsContext: () => ({ setActiveAction: jest.fn() }),
}))

jest.mock("@rn-vui/themed", () => ({
  ...jest.requireActual("@rn-vui/themed"),
  useTheme: () => ({ theme: { mode: "light" } }),
}))

import * as React from "react"
import { Text } from "react-native"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import { Action } from "@app/components/actions"
import {
  blockerEntryRoute,
  isMigrationDeeplink,
  NavigationContainerWrapper,
  processLinkForAction,
  useAuthenticationContext,
} from "@app/navigation/navigation-container-wrapper"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "@app/utils/enum"

describe("processLinkForAction", () => {
  it("returns null when no action query parameter is present", () => {
    expect(processLinkForAction("https://app.blink.sv/scan")).toBeNull()
  })

  it("returns SetLnAddress when action=set-ln-address", () => {
    expect(processLinkForAction("https://app.blink.sv/scan?action=set-ln-address")).toBe(
      Action.SetLnAddress,
    )
  })

  it("returns SetDefaultAccount when action=set-default-account", () => {
    expect(
      processLinkForAction("https://app.blink.sv/scan?action=set-default-account"),
    ).toBe(Action.SetDefaultAccount)
  })

  it("returns UpgradeAccount when action=upgrade-account", () => {
    expect(processLinkForAction("https://app.blink.sv/scan?action=upgrade-account")).toBe(
      Action.UpgradeAccount,
    )
  })

  it("normalises action casing (matches uppercase variants)", () => {
    expect(processLinkForAction("https://app.blink.sv/scan?action=SET-LN-ADDRESS")).toBe(
      Action.SetLnAddress,
    )
  })

  it("returns null for an unknown action value", () => {
    expect(
      processLinkForAction("https://app.blink.sv/scan?action=do-something"),
    ).toBeNull()
  })

  it("returns null when action parameter is empty", () => {
    expect(processLinkForAction("https://app.blink.sv/scan?action=")).toBeNull()
  })

  it("ignores other query parameters and matches only on `action`", () => {
    expect(
      processLinkForAction(
        "https://app.blink.sv/scan?other=set-ln-address&action=upgrade-account",
      ),
    ).toBe(Action.UpgradeAccount)
  })
})

describe("isMigrationDeeplink", () => {
  it("recognises the custom-scheme migration entry", () => {
    expect(isMigrationDeeplink("blink://account-migration")).toBe(true)
  })

  it("recognises the app-link migration entry", () => {
    expect(isMigrationDeeplink("https://app.blink.sv/account-migration")).toBe(true)
  })

  it("recognises the migration entry with a trailing slash", () => {
    expect(isMigrationDeeplink("blink://account-migration/")).toBe(true)
    expect(isMigrationDeeplink("https://app.blink.sv/account-migration/")).toBe(true)
  })

  it("rejects a payment deeplink that would open over the blocker", () => {
    expect(isMigrationDeeplink("lightning:lnbc1exampleinvoice")).toBe(false)
  })

  it("rejects other in-app deeplinks", () => {
    expect(isMigrationDeeplink("https://app.blink.sv/convert")).toBe(false)
  })

  it("rejects a crafted link that only contains the path as a query value", () => {
    expect(isMigrationDeeplink("blink://home?x=account-migration")).toBe(false)
    expect(isMigrationDeeplink("https://app.blink.sv/scan?to=account-migration")).toBe(
      false,
    )
  })

  it("rejects an unparseable url so it stays blocked while the gate is armed", () => {
    expect(isMigrationDeeplink("not a url")).toBe(false)
  })
})

describe("blockerEntryRoute", () => {
  it("routes a still-locked armed start through authenticationCheck so the PIN/biometric unlock is not skipped", () => {
    expect(blockerEntryRoute(true)).toBe("authenticationCheck")
  })

  it("routes an already-unlocked mid-session arming straight to the blocker under Primary, with no re-prompt", () => {
    expect(blockerEntryRoute(false)).toBe("Primary")
  })
})

/** Unlocks through the real AuthenticationContext, the same path the unlock screens take,
 *  when pressed; the lock state renders so a test can wait for it to settle. */
const UnlockProbe: React.FC = () => {
  const { isAppLocked, setAppUnlocked } = useAuthenticationContext()
  return (
    <Text testID="lock-state" onPress={setAppUnlocked}>
      {isAppLocked ? "locked" : "unlocked"}
    </Text>
  )
}

const RESET_TO_PRIMARY = { index: 0, routes: [{ name: "Primary" }] }
const RESET_TO_UNLOCK = { index: 0, routes: [{ name: "authenticationCheck" }] }

/** A deeplinked screen above the blocker, which is the only thing the reset exists for. */
const STACK_WITH_SCREEN_ABOVE = {
  index: 1,
  routes: [{ name: "Primary" }, { name: "scanningQRCode" }],
}
const STACK_AT_BLOCKER = { index: 0, routes: [{ name: "Primary" }] }
/** A cold start at the moment the bug struck: authenticationCheck has already replaced
 *  itself with the PIN pad, so the whole stack is the screen the user is typing into. */
const STACK_AT_COLD_START_UNLOCK = {
  index: 0,
  routes: [{ name: "pin", params: { screenPurpose: PinScreenPurpose.AuthenticatePin } }],
}
/** A resume lock, which pushes the unlock on top of whatever the user had open. */
const STACK_AT_RESUME_UNLOCK = {
  index: 2,
  routes: [
    { name: "Primary" },
    { name: "scanningQRCode" },
    { name: "pin", params: { screenPurpose: PinScreenPurpose.AuthenticatePin } },
  ],
}
/** A resume lock on a device with biometrics, and the PIN pad its fallback pushes over it. */
const STACK_AT_RESUME_BIOMETRICS = {
  index: 2,
  routes: [
    { name: "Primary" },
    { name: "scanningQRCode" },
    {
      name: "authentication",
      params: { screenPurpose: AuthenticationScreenPurpose.Authenticate },
    },
  ],
}
const STACK_AT_BIOMETRIC_PIN_FALLBACK = {
  index: 3,
  routes: [
    ...STACK_AT_RESUME_BIOMETRICS.routes,
    { name: "pin", params: { screenPurpose: PinScreenPurpose.AuthenticatePin } },
  ],
}

/** Settings reuses the pin route to SET a PIN, with the app already unlocked. */
const STACK_AT_SETTINGS_PIN = {
  index: 2,
  routes: [
    { name: "Primary" },
    { name: "security" },
    { name: "pin", params: { screenPurpose: PinScreenPurpose.SetPin } },
  ],
}

const unlock = () => fireEvent.press(screen.getByTestId("lock-state"))

/** Moves the stack and tells the container, the way a real navigation would. */
const navigateTo = (state: typeof mockRootState) => {
  mockRootState = state
  act(() => mockOnStateChange?.(state))
}

const renderWrapper = (children: React.ReactNode) =>
  render(<NavigationContainerWrapper>{children}</NavigationContainerWrapper>)

describe("NavigationContainerWrapper armed-gate reset", () => {
  /** onReady logs on the way past, which would print a console block from every spec that
   *  fires it. */
  const consoleLogSpy = jest.spyOn(console, "log")
  beforeAll(() => consoleLogSpy.mockImplementation(() => {}))
  afterAll(() => consoleLogSpy.mockRestore())

  beforeEach(() => {
    jest.clearAllMocks()
    mockBlockerVisible = false
    mockIsReady = true
    mockOnReady = undefined
    mockOnStateChange = undefined
    mockRootState = STACK_WITH_SCREEN_ABOVE
  })

  it("leaves an unlock in progress alone rather than restarting it", async () => {
    /** The blocker turns visible on a server answer that lands while the user is already
     *  typing their PIN. Resetting there tore that screen down and served an identical
     *  empty one, on every single launch (#4150). */
    mockBlockerVisible = true
    mockRootState = STACK_AT_COLD_START_UNLOCK

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(screen.getByTestId("lock-state")).toBeTruthy())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("resets once the unlock it was waiting on gets out of the way", async () => {
    mockBlockerVisible = true
    mockRootState = STACK_AT_RESUME_UNLOCK

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(screen.getByTestId("lock-state")).toBeTruthy())
    expect(mockReset).not.toHaveBeenCalled()

    /** The resume unlock steps back, uncovering the screen that was underneath it. */
    unlock()
    navigateTo(STACK_WITH_SCREEN_ABOVE)

    expect(mockReset).toHaveBeenCalledWith(RESET_TO_PRIMARY)
  })

  it("keeps waiting while an unlock is still on screen, lock down or not", async () => {
    /** Biometrics with a PIN fallback: "Use PIN" pushes the pad over the prompt, and the
     *  unlock steps back onto the prompt it came from with the lock already released. The
     *  way is not clear yet, so a retry keyed on the lock would spend itself here. */
    mockBlockerVisible = true
    mockRootState = STACK_AT_RESUME_BIOMETRICS

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(screen.getByTestId("lock-state")).toBeTruthy())

    navigateTo(STACK_AT_BIOMETRIC_PIN_FALLBACK)
    unlock()
    navigateTo(STACK_AT_RESUME_BIOMETRICS)

    expect(mockReset).not.toHaveBeenCalled()
  })

  it("resets a still-locked session sitting at the blocker, so the unlock can run", async () => {
    /** Signing in through a path that never passes an unlock screen leaves the lock raised
     *  for the whole session, and only the unlock entry lowers it and drains the queued
     *  deeplink, so there is a reason to reset even with nothing stacked above. */
    mockBlockerVisible = true
    mockRootState = STACK_AT_BLOCKER

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_UNLOCK))
  })

  it("pops a screen above a blocker that is not at the root of the stack", async () => {
    /** Signing in from getStarted replaces the last route, leaving the sign-in screens
     *  underneath Primary rather than the blocker at index 0. */
    mockBlockerVisible = true
    mockRootState = {
      index: 3,
      routes: [
        { name: "getStarted" },
        { name: "login" },
        { name: "Primary" },
        { name: "scanningQRCode" },
      ],
    }

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_UNLOCK))
  })

  it("leaves a stack the blocker is not even part of alone", async () => {
    /** Logging out of the unlock screen lands on the sign-in screen, which runs nothing over
     *  the closed account and reaches the blocker on its own once the user signs back in. */
    mockBlockerVisible = true
    mockRootState = STACK_AT_COLD_START_UNLOCK

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(screen.getByTestId("lock-state")).toBeTruthy())

    navigateTo({ index: 0, routes: [{ name: "getStarted" }] })

    expect(mockReset).not.toHaveBeenCalled()
  })

  it("does not bounce a logout that reset the stack without lowering the lock", async () => {
    /** Three wrong PINs log the user out and reset the stack themselves, never unlocking.
     *  A retry exists to finish a pop, not to route that session through the unlock. */
    mockBlockerVisible = true
    mockRootState = STACK_AT_RESUME_UNLOCK

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(screen.getByTestId("lock-state")).toBeTruthy())

    navigateTo(STACK_AT_BLOCKER)

    expect(mockReset).not.toHaveBeenCalled()
  })

  it("lands a retry on the blocker itself, never back on the unlock", async () => {
    /** Only arming owes a still-locked session a trip through the unlock. A retry that
     *  routed there would bounce the user off the screen it was only meant to pop. */
    mockBlockerVisible = true
    mockRootState = STACK_AT_RESUME_UNLOCK

    renderWrapper(<Text testID="child">child</Text>)

    navigateTo(STACK_WITH_SCREEN_ABOVE)

    expect(mockReset).toHaveBeenCalledWith(RESET_TO_PRIMARY)
  })

  it("does not come back for a reset the arming had already declined", async () => {
    /** A cold start has no blocker in its stack at all, so there is nothing to pop and no
     *  reason to keep watching for the unlock to end. */
    mockBlockerVisible = true
    mockRootState = STACK_AT_COLD_START_UNLOCK

    renderWrapper(<UnlockProbe />)

    unlock()
    navigateTo(STACK_WITH_SCREEN_ABOVE)

    expect(mockReset).not.toHaveBeenCalled()
  })

  it("drops a deferral the kill-switch outlived, rather than spending it on re-arming", async () => {
    mockBlockerVisible = true
    mockRootState = STACK_AT_RESUME_UNLOCK

    const { rerender } = renderWrapper(<UnlockProbe />)
    const rerenderWrapper = () =>
      rerender(
        <NavigationContainerWrapper>
          <UnlockProbe />
        </NavigationContainerWrapper>,
      )

    await waitFor(() => expect(screen.getByTestId("lock-state")).toBeTruthy())

    /** The kill-switch hides the gate, and the user gets on with the unlocked app. */
    mockBlockerVisible = false
    rerenderWrapper()
    unlock()
    navigateTo(STACK_AT_BLOCKER)

    /** Re-armed later, with nothing above the blocker, so nothing is owed. */
    mockBlockerVisible = true
    rerenderWrapper()
    expect(mockReset).not.toHaveBeenCalled()

    /** The migration deeplink the armed gate allows through opens. A deferral left over
     *  from the kill-switched round would pop it right back off. */
    navigateTo({
      index: 1,
      routes: [{ name: "Primary" }, { name: "accountMigrationEntry" }],
    })

    expect(mockReset).not.toHaveBeenCalled()
  })

  it("never pops the migration entry the armed gate lets through", async () => {
    /** The one deeplink the gate allows can only land after the gate armed, so a retry
     *  finishing an older job must leave it alone. */
    mockBlockerVisible = true
    mockRootState = STACK_AT_RESUME_UNLOCK

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(screen.getByTestId("lock-state")).toBeTruthy())

    unlock()
    navigateTo({
      index: 2,
      routes: [
        { name: "Primary" },
        { name: "scanningQRCode" },
        { name: "accountMigrationEntry" },
      ],
    })

    expect(mockReset).not.toHaveBeenCalled()
  })

  it("stops retrying once the kill-switch hides the blocker", async () => {
    mockBlockerVisible = true
    mockRootState = STACK_AT_RESUME_UNLOCK

    const { rerender } = renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(screen.getByTestId("lock-state")).toBeTruthy())

    mockBlockerVisible = false
    rerender(
      <NavigationContainerWrapper>
        <UnlockProbe />
      </NavigationContainerWrapper>,
    )
    unlock()
    navigateTo(STACK_WITH_SCREEN_ABOVE)

    expect(mockReset).not.toHaveBeenCalled()
  })

  it("treats the Settings PIN screen as no unlock at all", async () => {
    /** Settings pushes the same route to SET a PIN while the app is already unlocked, so
     *  the purpose decides; reading the name alone would strand the reset behind it. */
    mockRootState = STACK_AT_SETTINGS_PIN
    const { rerender } = renderWrapper(<UnlockProbe />)

    unlock()
    await waitFor(() =>
      expect(screen.getByTestId("lock-state").props.children).toBe("unlocked"),
    )

    mockBlockerVisible = true
    rerender(
      <NavigationContainerWrapper>
        <UnlockProbe />
      </NavigationContainerWrapper>,
    )

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_PRIMARY))
  })

  it("judges the route the user is looking at, not the last one on the stack", async () => {
    /** A reset can leave the focus somewhere other than the tail, and an unlock the user
     *  cannot see is not one to wait for. */
    mockBlockerVisible = true
    mockRootState = {
      index: 0,
      routes: [
        { name: "Primary" },
        { name: "pin", params: { screenPurpose: PinScreenPurpose.AuthenticatePin } },
      ],
    }

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_UNLOCK))
  })

  it("resets in a session that signs in without ever unlocking", async () => {
    /** Signing in from getStarted lands on Primary without touching an unlock screen, so
     *  the lock state stays raised for the whole session and the reset must not wait on it.
     *  It routes through the unlock entry, which releases that lock on the way past. */
    mockBlockerVisible = true

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_UNLOCK))
  })

  it("does not reset a second time on a later unlock, when nothing was waiting", async () => {
    /** The reset already ran when the gate armed. A resume lock and unlock over a screen
     *  the gate itself opened must not throw that screen away. */
    mockBlockerVisible = true

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1))

    mockRootState = STACK_WITH_SCREEN_ABOVE
    unlock()

    await waitFor(() =>
      expect(screen.getByTestId("lock-state").props.children).toBe("unlocked"),
    )
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it("leaves a stack with nothing above the blocker alone, rather than remounting it", async () => {
    mockRootState = STACK_AT_BLOCKER
    const { rerender } = renderWrapper(<UnlockProbe />)

    unlock()
    await waitFor(() =>
      expect(screen.getByTestId("lock-state").props.children).toBe("unlocked"),
    )

    mockBlockerVisible = true
    rerender(
      <NavigationContainerWrapper>
        <UnlockProbe />
      </NavigationContainerWrapper>,
    )

    expect(mockReset).not.toHaveBeenCalled()
  })

  it("leaves the stack alone when the container has no state to read", async () => {
    /** Nothing proven either way: neither an unlock to protect nor a route to pop. */
    mockBlockerVisible = true
    mockRootState = undefined

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(screen.getByTestId("child")).toBeTruthy())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("resets from onReady when the effect ran before the container was ready", async () => {
    mockBlockerVisible = true
    mockIsReady = false

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(screen.getByTestId("child")).toBeTruthy())
    expect(mockReset).not.toHaveBeenCalled()

    mockIsReady = true
    act(() => mockOnReady?.())

    expect(mockReset).toHaveBeenCalledWith(RESET_TO_UNLOCK)
  })

  it("takes no armed action while the blocker is hidden (incl. the kill-switch case)", async () => {
    /** useMigrationBlocker returns isVisible=false both when the gate is not armed and when
     *  the kill-switch hides an armed gate. The wrapper keys the stack reset AND the deeplink
     *  drop on that same visibility, so neither fires here: payment deeplinks keep flowing. */
    mockBlockerVisible = false

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(screen.getByTestId("child")).toBeTruthy())
    act(() => mockOnReady?.())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("resets to Primary (no re-prompt) when the gate arms after the app is already unlocked", async () => {
    const { rerender } = renderWrapper(<UnlockProbe />)

    unlock()
    await waitFor(() =>
      expect(screen.getByTestId("lock-state").props.children).toBe("unlocked"),
    )
    expect(mockReset).not.toHaveBeenCalled()

    mockBlockerVisible = true
    rerender(
      <NavigationContainerWrapper>
        <UnlockProbe />
      </NavigationContainerWrapper>,
    )

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_PRIMARY))
  })
})
