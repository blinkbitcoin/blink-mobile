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
const mockGetRootState = jest.fn()
let mockBlockerVisible = false
let mockIsReady = true

/** The navigationRef is module-level, so the container ref is stubbed to observe reset(),
 *  to serve the root stack the pop decides on, and to report readiness; the container itself
 *  just renders its children (its onReady is not needed: the pop runs from the effect, which
 *  fires once isReady() is true). */
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  createNavigationContainerRef: () => ({
    reset: (...args: unknown[]) => mockReset(...args),
    isReady: () => mockIsReady,
    getRootState: () => mockGetRootState(),
  }),
  NavigationContainer: ({ children }: { children?: React.ReactNode }) => children ?? null,
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
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import { Action } from "@app/components/actions"
import {
  isMigrationDeeplink,
  NavigationContainerWrapper,
  processLinkForAction,
  useAuthenticationContext,
} from "@app/navigation/navigation-container-wrapper"

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

const RESET_TO_BLOCKER = { index: 0, routes: [{ name: "Primary" }] }

/** A deeplinked screen above the blocker, which is the only thing the pop exists for. */
const STACK_WITH_SCREEN_ABOVE = {
  routes: [{ name: "Primary" }, { name: "scanningQRCode" }],
}
const STACK_AT_BLOCKER = { routes: [{ name: "Primary" }] }
/** A resume lock, which pushes the unlock on top of whatever the user had open. */
const STACK_AT_RESUME_UNLOCK = { routes: [{ name: "Primary" }, { name: "pin" }] }
/** A cold start, whose whole stack is the unlock flow. */
const STACK_AT_COLD_START_UNLOCK = { routes: [{ name: "authenticationCheck" }] }

const unlock = () => fireEvent.press(screen.getByTestId("lock-state"))

const renderWrapper = (children: React.ReactNode) =>
  render(<NavigationContainerWrapper>{children}</NavigationContainerWrapper>)

describe("NavigationContainerWrapper armed-gate pop", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBlockerVisible = false
    mockIsReady = true
    mockGetRootState.mockReturnValue(STACK_WITH_SCREEN_ABOVE)
  })

  it("leaves an unlock in progress alone rather than restarting it", async () => {
    /** The blocker turns visible on a server answer that lands while the user is already
     *  typing their PIN. Popping there tore that screen down and served an identical empty
     *  one, on every single launch (#4150). */
    mockBlockerVisible = true
    mockGetRootState.mockReturnValue(STACK_AT_COLD_START_UNLOCK)

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(mockGetRootState).toHaveBeenCalled())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("pops what an unlock was standing in front of once that unlock finishes", async () => {
    mockBlockerVisible = true
    mockGetRootState.mockReturnValue(STACK_AT_RESUME_UNLOCK)

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(mockGetRootState).toHaveBeenCalled())
    expect(mockReset).not.toHaveBeenCalled()

    /** The resume unlock steps back, uncovering the screen that was underneath it. */
    mockGetRootState.mockReturnValue(STACK_WITH_SCREEN_ABOVE)
    unlock()

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_BLOCKER))
  })

  it("pops in a session that signs in without ever unlocking", async () => {
    /** Signing in from getStarted lands on Primary without touching an unlock screen, so
     *  the lock state stays raised for the whole session and the pop must not wait on it. */
    mockBlockerVisible = true

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_BLOCKER))
  })

  it("does not pop a second time on a later unlock, when no pop was waiting", async () => {
    /** The pop already ran when the gate armed. A resume lock and unlock over a screen the
     *  gate itself opened (the dollar transfer) must not throw that screen away. */
    mockBlockerVisible = true

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1))

    mockGetRootState.mockReturnValue(STACK_WITH_SCREEN_ABOVE)
    unlock()

    await waitFor(() =>
      expect(screen.getByTestId("lock-state").props.children).toBe("unlocked"),
    )
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it("leaves a stack that is already just the blocker alone, rather than remounting it", async () => {
    mockBlockerVisible = true
    mockGetRootState.mockReturnValue(STACK_AT_BLOCKER)

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(mockGetRootState).toHaveBeenCalled())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("leaves the stack alone when the container has no state to read", async () => {
    /** Nothing to pop that can be proven, so nothing is thrown away on a guess. */
    mockBlockerVisible = true
    mockGetRootState.mockReturnValue(undefined)

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(mockGetRootState).toHaveBeenCalled())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("leaves the stack alone when the container reports no routes", async () => {
    mockBlockerVisible = true
    mockGetRootState.mockReturnValue({ routes: [] })

    renderWrapper(<UnlockProbe />)

    await waitFor(() => expect(mockGetRootState).toHaveBeenCalled())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("reads nothing and pops nothing while the container is not ready", async () => {
    /** onReady runs the pop again, so bailing out here loses nothing. */
    mockBlockerVisible = true
    mockIsReady = false

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(screen.getByTestId("child")).toBeTruthy())
    expect(mockGetRootState).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("takes no armed action while the blocker is hidden (incl. the kill-switch case)", async () => {
    /** useMigrationBlocker returns isVisible=false both when the gate is not armed and when
     *  the kill-switch hides an armed gate. The wrapper keys the stack pop AND the deeplink
     *  drop on that same visibility, so neither fires here: payment deeplinks keep flowing. */
    mockBlockerVisible = false

    renderWrapper(<Text testID="child">child</Text>)

    await waitFor(() => expect(screen.getByTestId("child")).toBeTruthy())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("pops when the gate arms after the app is already unlocked", async () => {
    const { rerender } = renderWrapper(<UnlockProbe />)

    unlock()
    await waitFor(() =>
      expect(screen.getByTestId("lock-state").props.children).toBe("unlocked"),
    )
    expect(mockReset).not.toHaveBeenCalled()

    // Arm the gate on the same, already-unlocked instance.
    mockBlockerVisible = true
    rerender(
      <NavigationContainerWrapper>
        <UnlockProbe />
      </NavigationContainerWrapper>,
    )

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(RESET_TO_BLOCKER))
  })
})
