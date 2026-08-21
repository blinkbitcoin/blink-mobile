import {
  canGoBackFromChooseExperience,
  ChooseExperienceContinueRoute,
} from "@app/navigation/stack-param-lists"

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
