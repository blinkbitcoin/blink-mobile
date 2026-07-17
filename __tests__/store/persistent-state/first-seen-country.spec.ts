import {
  getFirstSeenCountryCode,
  withFirstSeenCountryCode,
} from "@app/store/persistent-state/first-seen-country"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getFirstSeenCountryCode", () => {
  it("returns undefined as the default", () => {
    expect(getFirstSeenCountryCode(baseState)).toBeUndefined()
  })

  it("returns the persisted country code", () => {
    expect(getFirstSeenCountryCode({ ...baseState, firstSeenCountryCode: "SV" })).toBe(
      "SV",
    )
  })
})

describe("withFirstSeenCountryCode", () => {
  it("sets the country code", () => {
    expect(withFirstSeenCountryCode(baseState, "SV").firstSeenCountryCode).toBe("SV")
  })

  it("replaces an existing country code", () => {
    expect(
      withFirstSeenCountryCode({ ...baseState, firstSeenCountryCode: "PL" }, "SV")
        .firstSeenCountryCode,
    ).toBe("SV")
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = { ...baseState, firstSeenCountryCode: "PL" }
    const snapshot = JSON.parse(JSON.stringify(original))

    withFirstSeenCountryCode(original, "SV")

    expect(original).toEqual(snapshot)
  })
})
