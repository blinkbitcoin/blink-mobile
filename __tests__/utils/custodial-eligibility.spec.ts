import { decideCustodialEligibility } from "@app/utils/custodial-eligibility"

const baseInputs = {
  country: "SV",
  accountCount: 0,
  custodialSignupBlockedCountries: ["US"],
  custodialFirstSignupBlockedCountries: ["GB", "DE"],
}

describe("decideCustodialEligibility", () => {
  describe("country in always-blocked list", () => {
    it("blocks signup as first account", () => {
      expect(decideCustodialEligibility({ ...baseInputs, country: "US" })).toBe(false)
    })

    it("blocks signup even with existing accounts", () => {
      expect(
        decideCustodialEligibility({ ...baseInputs, country: "US", accountCount: 3 }),
      ).toBe(false)
    })
  })

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

  describe("country not in any list", () => {
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
      expect(decideCustodialEligibility({ ...baseInputs, country: undefined })).toBe(false)
    })
  })

  describe("precedence — always-block list outranks first-signup carve-out", () => {
    it("blocks a country present in both lists with an existing account", () => {
      expect(
        decideCustodialEligibility({
          ...baseInputs,
          country: "US",
          accountCount: 1,
          custodialSignupBlockedCountries: ["US"],
          custodialFirstSignupBlockedCountries: ["US"],
        }),
      ).toBe(false)
    })
  })

  describe("empty remote config lists", () => {
    it("allows signup everywhere when both lists are empty", () => {
      expect(
        decideCustodialEligibility({
          ...baseInputs,
          country: "US",
          custodialSignupBlockedCountries: [],
          custodialFirstSignupBlockedCountries: [],
        }),
      ).toBe(true)
    })
  })
})
