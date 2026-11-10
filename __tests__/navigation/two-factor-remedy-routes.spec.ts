import {
  hasWorkingScreenAboveHome,
  isSetupKeyAtStake,
  isTotpRegistrationRoute,
  isTwoFactorRemedyRoute,
  totpRegistrationStart,
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
        { name: "totpRegistrationInitiate" },
      ]),
    ).toBe(false)
  })

  /** Neither is a second factor, so neither is a remedy the gate opened: one of them
   *  above the home, from a deep link or otherwise, is the user's own. */
  it("sees an email or phone registration above the home as the user's own screen", () => {
    expect(hasWorkingScreenAboveHome([home, { name: "emailRegistrationInitiate" }])).toBe(
      true,
    )
    expect(hasWorkingScreenAboveHome([home, { name: "phoneRegistrationInitiate" }])).toBe(
      true,
    )
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
        { name: "totpRegistrationInitiate" },
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
  it("recognises the setup, the non-custodial screen, the authenticator registration and the migration", () => {
    expect(isTwoFactorRemedyRoute("twoFactorSetup")).toBe(true)
    expect(isTwoFactorRemedyRoute("twoFactorNonCustodial")).toBe(true)
    expect(isTwoFactorRemedyRoute("totpRegistrationInitiate")).toBe(true)
    expect(isTwoFactorRemedyRoute("totpRegistrationValidate")).toBe(true)
    expect(isTwoFactorRemedyRoute("accountMigrationEntry")).toBe(true)
  })

  it("recognises every screen of the authenticator onboarding, through to its backup", () => {
    expect(isTwoFactorRemedyRoute("totpRegistrationIntro")).toBe(true)
    expect(isTwoFactorRemedyRoute("totpRegistrationApps")).toBe(true)
    expect(isTwoFactorRemedyRoute("totpRegistrationBackup")).toBe(true)
    expect(isTwoFactorRemedyRoute("totpRegistrationDone")).toBe(true)
  })

  it("treats any other screen as a working one the gate must not be bypassed through", () => {
    expect(isTwoFactorRemedyRoute("sendBitcoinDestination")).toBe(false)
    expect(isTwoFactorRemedyRoute("settings")).toBe(false)
    expect(isTwoFactorRemedyRoute("Primary")).toBe(false)
    expect(isTwoFactorRemedyRoute("emailRegistrationValidate")).toBe(false)
    expect(isTwoFactorRemedyRoute("phoneRegistrationInitiate")).toBe(false)
  })
})

describe("totpRegistrationStart", () => {
  const stack = (...names: string[]) => names.map((name) => ({ name }))

  it("points at the first screen of the registration at the top of the stack", () => {
    expect(
      totpRegistrationStart(
        stack("Primary", "settings", "totpRegistrationIntro", "totpRegistrationApps"),
      ),
    ).toBe(2)
  })

  it("counts the whole stack when it is all registration", () => {
    expect(
      totpRegistrationStart(
        stack("totpRegistrationInitiate", "totpRegistrationValidate"),
      ),
    ).toBe(0)
  })

  it("stops at the first screen below the top that is no part of the registration", () => {
    expect(
      totpRegistrationStart(
        stack(
          "Primary",
          "totpRegistrationIntro",
          "twoFactorSetup",
          "totpRegistrationBackup",
        ),
      ),
    ).toBe(3)
  })

  it("finds the registration that runs up to a given screen, under whatever is above it", () => {
    const routes = stack(
      "Primary",
      "totpRegistrationIntro",
      "totpRegistrationValidate",
      "authenticationCheck",
    )

    expect(totpRegistrationStart(routes, 2)).toBe(1)
    expect(totpRegistrationStart(routes)).toBe(4)
  })

  it("points past the end when the top is no part of a registration", () => {
    expect(totpRegistrationStart(stack("Primary", "settings"))).toBe(2)
    expect(totpRegistrationStart([])).toBe(0)
  })
})

describe("isTotpRegistrationRoute", () => {
  it("recognises every screen of the authenticator registration and nothing else", () => {
    expect(isTotpRegistrationRoute("totpRegistrationIntro")).toBe(true)
    expect(isTotpRegistrationRoute("totpRegistrationBackup")).toBe(true)
    expect(isTotpRegistrationRoute("twoFactorSetup")).toBe(false)
    expect(isTotpRegistrationRoute("totpLoginValidate")).toBe(false)
  })
})

describe("isSetupKeyAtStake", () => {
  const routesOf = (...names: string[]) => names.map((name) => ({ name }))
  const checkingCode = (isChecking: boolean) => ({
    name: "totpRegistrationValidate",
    params: { totpRegistrationId: "reg", secret: "SECRET", isChecking },
  })

  it("is at stake while a code is checked", () => {
    expect(isSetupKeyAtStake([...routesOf("Primary"), checkingCode(true)])).toBe(true)
  })

  /** No authenticator is on yet: a link that closes the screen loses only progress. */
  it("is not at stake on the code screen before a code is sent", () => {
    expect(isSetupKeyAtStake(routesOf("Primary", "totpRegistrationValidate"))).toBe(false)
    expect(isSetupKeyAtStake([...routesOf("Primary"), checkingCode(false)])).toBe(false)
  })

  it("is at stake while the backup is up", () => {
    expect(isSetupKeyAtStake(routesOf("Primary", "totpRegistrationBackup"))).toBe(true)
  })

  /** The unlock that covers the registration on a return must not let a link through. */
  it("is at stake under a screen pushed over the registration", () => {
    expect(
      isSetupKeyAtStake([
        ...routesOf("Primary", "totpRegistrationBackup"),
        { name: "authentication" },
      ]),
    ).toBe(true)
    expect(
      isSetupKeyAtStake([
        ...routesOf("Primary"),
        checkingCode(true),
        { name: "authentication" },
      ]),
    ).toBe(true)
  })

  it("is not at stake once the done screen has taken the backup's place", () => {
    expect(isSetupKeyAtStake(routesOf("Primary", "totpRegistrationDone"))).toBe(false)
  })

  it("is not at stake earlier in the registration, or with none open", () => {
    expect(isSetupKeyAtStake(routesOf("Primary", "totpRegistrationInitiate"))).toBe(false)
    expect(isSetupKeyAtStake(routesOf("Primary", "accountScreen"))).toBe(false)
  })
})
