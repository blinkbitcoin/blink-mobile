import {
  getStablesatsRestricted,
  withStablesatsRestricted,
} from "@app/store/persistent-state/stablesats-restriction"
import {
  CURRENT_SCHEMA_VERSION,
  PersistentState,
} from "@app/store/persistent-state/state-migrations"

const baseState: PersistentState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getStablesatsRestricted", () => {
  it("returns false as the default", () => {
    expect(getStablesatsRestricted(baseState)).toBe(false)
  })

  it("returns true once the custodial restriction is set", () => {
    expect(
      getStablesatsRestricted({ ...baseState, stablesatsRestrictedCustodial: true }),
    ).toBe(true)
  })
})

describe("withStablesatsRestricted", () => {
  it("sets the custodial restriction flag", () => {
    const next = withStablesatsRestricted(baseState)

    expect(next.stablesatsRestrictedCustodial).toBe(true)
  })

  it("keeps the flag set when already restricted", () => {
    const next = withStablesatsRestricted({
      ...baseState,
      stablesatsRestrictedCustodial: true,
    })

    expect(next.stablesatsRestrictedCustodial).toBe(true)
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = { ...baseState }
    const snapshot = JSON.parse(JSON.stringify(original))

    withStablesatsRestricted(original)

    expect(original).toEqual(snapshot)
  })
})
