jest.mock("@app/config/custodial-countries", () => ({
  CUSTODIAL_ALLOWED_COUNTRIES: ["SV", "AR"],
}))

import { isCustodialAllowedForCountry } from "@app/config/custodial-eligibility"

describe("isCustodialAllowedForCountry", () => {
  it("returns false when the country code is undefined", () => {
    expect(isCustodialAllowedForCountry(undefined)).toBe(false)
  })

  it("returns false when the country code is empty", () => {
    expect(isCustodialAllowedForCountry("")).toBe(false)
  })

  it("returns true when the country code is on the allow-list", () => {
    expect(isCustodialAllowedForCountry("SV")).toBe(true)
    expect(isCustodialAllowedForCountry("AR")).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(isCustodialAllowedForCountry("sv")).toBe(true)
  })

  it("returns false for a country that is not allow-listed", () => {
    expect(isCustodialAllowedForCountry("US")).toBe(false)
  })
})
