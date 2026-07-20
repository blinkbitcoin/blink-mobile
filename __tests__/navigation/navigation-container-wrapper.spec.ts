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

import { Action } from "@app/components/actions"
import {
  isMigrationDeeplink,
  processLinkForAction,
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
