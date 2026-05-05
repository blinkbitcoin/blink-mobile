import { CUSTODIAL_BLOCKED_COUNTRIES } from "@app/config/custodial-countries"

describe("CUSTODIAL_BLOCKED_COUNTRIES", () => {
  it("contains only uppercase ISO-3166 alpha-2 codes", () => {
    CUSTODIAL_BLOCKED_COUNTRIES.forEach((code) => {
      expect(code).toMatch(/^[A-Z]{2}$/)
    })
  })

  it("has no duplicates", () => {
    expect(new Set(CUSTODIAL_BLOCKED_COUNTRIES).size).toBe(
      CUSTODIAL_BLOCKED_COUNTRIES.length,
    )
  })
})
