import { withSelfCustodialAccountMode } from "@app/store/persistent-state/self-custodial-account-mode"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 17,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("withSelfCustodialAccountMode", () => {
  it("writes the mode under the given account id", () => {
    const next = withSelfCustodialAccountMode(
      baseState,
      "self-custodial-1",
      AccountMode.Anon,
    )

    expect(next.selfCustodialAccountModeByAccountId).toEqual({
      "self-custodial-1": AccountMode.Anon,
    })
  })

  it("stores the mode for the onboarding account even when it is not the active one", () => {
    // A migration provisions the self-custodial account while custodial is still active.
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    const next = withSelfCustodialAccountMode(
      state,
      "provisioned-sc-1",
      AccountMode.Enhanced,
    )

    expect(next.selfCustodialAccountModeByAccountId).toEqual({
      "provisioned-sc-1": AccountMode.Enhanced,
    })
  })

  it("preserves entries for other accounts (multi-account)", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Enhanced },
    }

    const next = withSelfCustodialAccountMode(state, "self-custodial-2", AccountMode.Anon)

    expect(next.selfCustodialAccountModeByAccountId).toEqual({
      "self-custodial-1": AccountMode.Enhanced,
      "self-custodial-2": AccountMode.Anon,
    })
  })

  it("overwrites the existing mode for the given id", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Enhanced },
    }

    const next = withSelfCustodialAccountMode(state, "self-custodial-1", AccountMode.Anon)

    expect(next.selfCustodialAccountModeByAccountId).toEqual({
      "self-custodial-1": AccountMode.Anon,
    })
  })
})
