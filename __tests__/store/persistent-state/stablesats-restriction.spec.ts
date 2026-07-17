import {
  getStablesatsRestricted,
  withStablesatsRestricted,
  withoutStablesatsRestricted,
} from "@app/store/persistent-state/stablesats-restriction"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const baseState: PersistentState = {
  schemaVersion: 14,
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

describe("withoutStablesatsRestricted", () => {
  it("clears the flag when set", () => {
    expect(
      getStablesatsRestricted(
        withoutStablesatsRestricted(withStablesatsRestricted(baseState)),
      ),
    ).toBe(false)
  })

  it("keeps the flag cleared when already unset", () => {
    expect(getStablesatsRestricted(withoutStablesatsRestricted(baseState))).toBe(false)
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = {
      ...baseState,
      stablesatsRestrictedCustodial: true,
    }
    const snapshot = JSON.parse(JSON.stringify(original))

    withoutStablesatsRestricted(original)

    expect(original).toEqual(snapshot)
  })
})
