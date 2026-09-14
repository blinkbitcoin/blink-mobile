import { decideCustodialEligibility } from "@app/utils/custodial-eligibility"

const baseInputs = {
  country: "SV",
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

  describe("an unreadable location", () => {
    it("fails closed, since an untrusted location must not open signup", () => {
      expect(decideCustodialEligibility({ ...baseInputs, country: undefined })).toBe(
        false,
      )
    })

    it("fails closed even for a holder of existing accounts", () => {
      expect(
        decideCustodialEligibility({
          ...baseInputs,
          country: undefined,
          accountCount: 5,
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
