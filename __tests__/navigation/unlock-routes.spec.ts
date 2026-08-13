import { isUnlockInProgress } from "@app/navigation/unlock-routes"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "@app/utils/enum"

describe("isUnlockInProgress", () => {
  it("counts the unlock check, which exists for nothing else", () => {
    expect(isUnlockInProgress({ name: "authenticationCheck" })).toBe(true)
  })

  it("counts a PIN pad that is authenticating", () => {
    expect(
      isUnlockInProgress({
        name: "pin",
        params: { screenPurpose: PinScreenPurpose.AuthenticatePin },
      }),
    ).toBe(true)
  })

  it("does not count the same PIN pad when Settings is setting a PIN", () => {
    expect(
      isUnlockInProgress({
        name: "pin",
        params: { screenPurpose: PinScreenPurpose.SetPin },
      }),
    ).toBe(false)
  })

  it("counts a biometric prompt that is authenticating", () => {
    expect(
      isUnlockInProgress({
        name: "authentication",
        params: { screenPurpose: AuthenticationScreenPurpose.Authenticate },
      }),
    ).toBe(true)
  })

  it("does not count the same prompt when Settings is turning biometrics on", () => {
    expect(
      isUnlockInProgress({
        name: "authentication",
        params: { screenPurpose: AuthenticationScreenPurpose.TurnOnAuthentication },
      }),
    ).toBe(false)
  })

  it("does not count a shared route that arrived without a purpose", () => {
    expect(isUnlockInProgress({ name: "pin" })).toBe(false)
  })

  it("does not count a route the unlock flow does not use", () => {
    expect(isUnlockInProgress({ name: "Primary" })).toBe(false)
  })
})
