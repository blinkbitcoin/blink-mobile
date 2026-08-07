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

/** The navigationRef is module-level, so the container ref is stubbed to observe reset()
 *  and the container itself just renders its children (its onReady is not needed: the same
 *  reset runs from the mid-session effect, which fires on mount once isReady() is true). */
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  createNavigationContainerRef: () => ({
    reset: (...args: unknown[]) => mockReset(...args),
    isReady: () => true,
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
import { render, screen, waitFor } from "@testing-library/react-native"

import { Action } from "@app/components/actions"
import {
  blockerEntryRoute,
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

describe("blockerEntryRoute", () => {
  it("routes a still-locked armed start through authenticationCheck so the PIN/biometric unlock is not skipped", () => {
    expect(blockerEntryRoute(true)).toBe("authenticationCheck")
  })

  it("routes an already-unlocked mid-session arming straight to the blocker under Primary, with no re-prompt", () => {
    expect(blockerEntryRoute(false)).toBe("Primary")
  })
})

/** Unlocks the app through the real AuthenticationContext (the same path the auth screens
 *  use) and renders the current lock state so a test can wait for it to settle. */
const LockStateProbe: React.FC = () => {
  const { isAppLocked, setAppUnlocked } = useAuthenticationContext()
  React.useEffect(() => {
    setAppUnlocked()
  }, [setAppUnlocked])
  return <Text testID="lock-state">{isAppLocked ? "locked" : "unlocked"}</Text>
}

describe("NavigationContainerWrapper armed-gate reset", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBlockerVisible = false
  })

  it("resets a still-locked armed launch to authenticationCheck so the unlock is not skipped", async () => {
    mockBlockerVisible = true

    render(
      <NavigationContainerWrapper>
        <Text testID="child">child</Text>
      </NavigationContainerWrapper>,
    )

    await waitFor(() =>
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "authenticationCheck" }],
      }),
    )
  })

  it("takes no armed action while the blocker is hidden (incl. the kill-switch case)", async () => {
    /** useMigrationBlocker returns isVisible=false both when the gate is not armed and when
     *  the kill-switch hides an armed gate. The wrapper keys the stack reset AND the deeplink
     *  drop on that same visibility, so neither fires here: payment deeplinks keep flowing. */
    mockBlockerVisible = false
    render(
      <NavigationContainerWrapper>
        <Text testID="child">child</Text>
      </NavigationContainerWrapper>,
    )

    await waitFor(() => expect(screen.getByTestId("child")).toBeTruthy())
    expect(mockReset).not.toHaveBeenCalled()
  })

  it("resets to Primary (no re-prompt) when the gate arms after the app is already unlocked", async () => {
    const { rerender } = render(
      <NavigationContainerWrapper>
        <LockStateProbe />
      </NavigationContainerWrapper>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("lock-state").props.children).toBe("unlocked"),
    )
    expect(mockReset).not.toHaveBeenCalled()

    // Arm the gate on the same, already-unlocked instance so the reset reads isAppLocked=false.
    mockBlockerVisible = true
    rerender(
      <NavigationContainerWrapper>
        <LockStateProbe />
      </NavigationContainerWrapper>,
    )

    await waitFor(() =>
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "Primary" }],
      }),
    )
  })
})
