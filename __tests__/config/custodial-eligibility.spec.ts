jest.mock("@app/config/custodial-countries", () => ({
  CUSTODIAL_BLOCKED_COUNTRIES: ["US", "DE"],
}))

import { isCustodialAllowedForCountry } from "@app/config/custodial-eligibility"

describe("isCustodialAllowedForCountry", () => {
  it("returns false when the country code is undefined", () => {
    expect(isCustodialAllowedForCountry(undefined)).toBe(false)
  })

  it("returns false when the country code is empty", () => {
    expect(isCustodialAllowedForCountry("")).toBe(false)
  })

  it("returns false when the country code is on the deny-list", () => {
    expect(isCustodialAllowedForCountry("US")).toBe(false)
    expect(isCustodialAllowedForCountry("DE")).toBe(false)
  })

  it("is case-insensitive against the deny-list", () => {
    expect(isCustodialAllowedForCountry("us")).toBe(false)
  })

  it("returns true for any country not on the deny-list", () => {
    expect(isCustodialAllowedForCountry("SV")).toBe(true)
    expect(isCustodialAllowedForCountry("HN")).toBe(true)
    expect(isCustodialAllowedForCountry("MX")).toBe(true)
  })
})
