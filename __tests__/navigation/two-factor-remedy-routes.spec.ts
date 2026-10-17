import {
  hasWorkingScreenAboveHome,
  isTwoFactorRemedyRoute,
} from "@app/navigation/two-factor-remedy-routes"
import { PinScreenPurpose } from "@app/utils/enum"

describe("hasWorkingScreenAboveHome", () => {
  const home = { name: "Primary" }

  it("sees a payment or the settings above the home as the user's own screen", () => {
    expect(hasWorkingScreenAboveHome([home, { name: "sendBitcoinDestination" }])).toBe(
      true,
    )
    expect(hasWorkingScreenAboveHome([home, { name: "settings" }])).toBe(true)
  })

  it("sees nothing of the user's above a home with only the gate's remedies, or nothing at all", () => {
    expect(hasWorkingScreenAboveHome([home])).toBe(false)
    expect(
      hasWorkingScreenAboveHome([
        home,
        { name: "twoFactorSetup" },
        { name: "emailRegistrationInitiate" },
      ]),
    ).toBe(false)
  })

  /** The migration a remedy leads into pushes steps under names of its own. */
  it("leaves whatever a remedy flow pushed after it to the flow", () => {
    expect(
      hasWorkingScreenAboveHome([
        home,
        { name: "twoFactorNonCustodial" },
        { name: "accountMigrationEntry" },
        { name: "acceptTermsAndConditions" },
        { name: "conversionDetails" },
      ]),
    ).toBe(false)
  })

  it("sees a screen of the user's that a remedy was reached from", () => {
    expect(
      hasWorkingScreenAboveHome([
        home,
        { name: "settings" },
        { name: "emailRegistrationInitiate" },
      ]),
    ).toBe(true)
  })

  it("does not count the unlock that covers the app", () => {
    const unlock = {
      name: "pin",
      params: { screenPurpose: PinScreenPurpose.AuthenticatePin },
    }
    expect(hasWorkingScreenAboveHome([home, unlock])).toBe(false)
  })

  it("sees nothing of the user's on a stack without the home", () => {
    expect(hasWorkingScreenAboveHome([{ name: "login" }])).toBe(false)
  })
})

describe("isTwoFactorRemedyRoute", () => {
  it("recognises the setup, the non-custodial screen, the factor registrations and the migration", () => {
    expect(isTwoFactorRemedyRoute("twoFactorSetup")).toBe(true)
    expect(isTwoFactorRemedyRoute("twoFactorNonCustodial")).toBe(true)
    expect(isTwoFactorRemedyRoute("emailRegistrationValidate")).toBe(true)
    expect(isTwoFactorRemedyRoute("phoneRegistrationInitiate")).toBe(true)
    expect(isTwoFactorRemedyRoute("totpRegistrationInitiate")).toBe(true)
    expect(isTwoFactorRemedyRoute("accountMigrationEntry")).toBe(true)
  })

  it("treats any other screen as a working one the gate must not be bypassed through", () => {
    expect(isTwoFactorRemedyRoute("sendBitcoinDestination")).toBe(false)
    expect(isTwoFactorRemedyRoute("settings")).toBe(false)
    expect(isTwoFactorRemedyRoute("Primary")).toBe(false)
  })
})
