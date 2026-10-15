import {
  canGoBackFromChooseExperience,
  canReturnToRoute,
  ChooseExperienceContinueRoute,
} from "@app/navigation/stack-param-lists"

describe("canReturnToRoute", () => {
  const stackWith = (...names: string[]) => ({ routes: names.map((name) => ({ name })) })

  it("lets a flow return to the two-factor setup while that screen is in its stack", () => {
    expect(
      canReturnToRoute(
        stackWith("Primary", "twoFactorSetup", "emailRegistrationInitiate"),
        "twoFactorSetup",
      ),
    ).toBe(true)
  })

  /** The param reaches the registration screens through deep links too, so a name the
   *  stack never had must not be dispatched. */
  it("refuses a return route the stack does not hold", () => {
    expect(
      canReturnToRoute(
        stackWith("Primary", "emailRegistrationInitiate"),
        "twoFactorSetup",
      ),
    ).toBe(false)
  })

  /** A deep link can name any route the app holds; only the setup is a place a flow
   *  may return to. */
  it("refuses a route the stack holds but a flow may not return to", () => {
    expect(canReturnToRoute(stackWith("Primary", "twoFactorSetup"), "Primary")).toBe(
      false,
    )
  })

  it("refuses when no return route was asked for", () => {
    expect(canReturnToRoute(stackWith("Primary", "twoFactorSetup"), undefined)).toBe(
      false,
    )
  })

  it("refuses when the navigator has no state to check against", () => {
    expect(canReturnToRoute(undefined, "twoFactorSetup")).toBe(false)
  })
})

describe("canGoBackFromChooseExperience", () => {
  /** Settings carries no onward step: it opened this screen over a live session, which is a
   *  coherent place to return to. */
  it("allows going back from the settings entry, which has no onward step", () => {
    expect(canGoBackFromChooseExperience(null)).toBe(true)
  })

  it("allows going back from the creation entry, which provisioned nothing yet", () => {
    expect(
      canGoBackFromChooseExperience({
        route: ChooseExperienceContinueRoute.AcceptTerms,
      }),
    ).toBe(true)
  })

  /** Restore activates the account and reinitialises the SDK before navigating here, and
   *  only the screen ahead resets to Primary. Going back lands on the restore-phrase screen
   *  with a live account behind it and no mode recorded. */
  it("refuses the restore entry, which arrives with the account already activated", () => {
    expect(
      canGoBackFromChooseExperience({
        route: ChooseExperienceContinueRoute.BackupSuccess,
        accountId: "restored-account",
      }),
    ).toBe(false)
  })

  /** The migration reaches this screen with the provisioned account backed up, so the step
   *  behind it is one the user already completed and must not repeat. */
  it("refuses the migration entry, which arrives past its backup", () => {
    expect(
      canGoBackFromChooseExperience({
        route: ChooseExperienceContinueRoute.BalancesOverview,
        accountId: "migration-account",
      }),
    ).toBe(false)
  })
})
