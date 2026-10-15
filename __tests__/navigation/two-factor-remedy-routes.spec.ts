import { isTwoFactorRemedyRoute } from "@app/navigation/two-factor-remedy-routes"

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
