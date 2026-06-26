import {
  getStableTokenRestricted,
  withStableTokenRestricted,
} from "@app/store/persistent-state/stable-token-restriction"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getStableTokenRestricted", () => {
  it("returns false as the default", () => {
    expect(getStableTokenRestricted(baseState)).toBe(false)
  })

  it("returns true once the flag is set", () => {
    expect(getStableTokenRestricted({ ...baseState, stableTokenRestricted: true })).toBe(
      true,
    )
  })
})

describe("withStableTokenRestricted", () => {
  it("sets the flag", () => {
    expect(withStableTokenRestricted(baseState).stableTokenRestricted).toBe(true)
  })

  it("keeps the flag set when already restricted", () => {
    expect(
      withStableTokenRestricted({ ...baseState, stableTokenRestricted: true })
        .stableTokenRestricted,
    ).toBe(true)
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = { ...baseState }
    const snapshot = JSON.parse(JSON.stringify(original))

    withStableTokenRestricted(original)

    expect(original).toEqual(snapshot)
  })
})
