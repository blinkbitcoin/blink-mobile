import { decideCustodialEligibility } from "@app/utils/custodial-eligibility"

const baseInputs = {
  country: "SV",
  detectionFailed: false,
  accountCount: 0,
  custodialFirstSignupBlockedCountries: ["GB", "DE"],
}

describe("decideCustodialEligibility", () => {
  describe("country in first-signup-blocked list", () => {
    it("blocks signup when there are no accounts yet", () => {
      expect(decideCustodialEligibility({ ...baseInputs, country: "GB" })).toBe(false)
    })

    it("allows signup when at least one account already exists", () => {
      expect(
        decideCustodialEligibility({ ...baseInputs, country: "GB", accountCount: 1 }),
      ).toBe(true)
    })
  })

  describe("country not in the list", () => {
    it("allows signup as first account", () => {
      expect(decideCustodialEligibility({ ...baseInputs, country: "SV" })).toBe(true)
    })

    it("allows signup with existing accounts", () => {
      expect(
        decideCustodialEligibility({ ...baseInputs, country: "SV", accountCount: 2 }),
      ).toBe(true)
    })
  })

  describe("country undefined", () => {
    it("fails closed: returns false when country has not been resolved", () => {
      expect(decideCustodialEligibility({ ...baseInputs, country: undefined })).toBe(
        false,
      )
    })
  })

  describe("detection failure (fallback country)", () => {
    it("fails closed when the resolved country came from a detection-failure fallback, regardless of country", () => {
      expect(
        decideCustodialEligibility({
          ...baseInputs,
          country: "SV",
          detectionFailed: true,
        }),
      ).toBe(false)
    })

    it("fails closed even for an unblocked country with existing accounts when detection failed", () => {
      expect(
        decideCustodialEligibility({
          ...baseInputs,
          country: "SV",
          accountCount: 5,
          detectionFailed: true,
        }),
      ).toBe(false)
    })
  })

  describe("empty first-signup list", () => {
    it("allows signup everywhere when the list is empty", () => {
      expect(
        decideCustodialEligibility({
          ...baseInputs,
          country: "GB",
          custodialFirstSignupBlockedCountries: [],
        }),
      ).toBe(true)
    })
  })
})
