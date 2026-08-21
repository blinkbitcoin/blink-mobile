import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 20,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("resolveActiveSelfCustodialId", () => {
  it("returns the active id when it is a self-custodial account", () => {
    const state: PersistentState = { ...baseState, activeAccountId: "self-custodial-1" }

    expect(resolveActiveSelfCustodialId(state)).toBe("self-custodial-1")
  })

  it("returns null when the active account is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    expect(resolveActiveSelfCustodialId(state)).toBeNull()
  })

  it("returns null when there is no active account", () => {
    expect(resolveActiveSelfCustodialId(baseState)).toBeNull()
  })
})
