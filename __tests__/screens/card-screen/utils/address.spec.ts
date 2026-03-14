import {
  validatePOBox,
  validatePostalCode,
  addressToLines,
  AddressFields,
} from "@app/screens/card-screen/utils/address"

jest.mock("postcode-validator", () => ({
  postcodeValidator: (value: string, country: string) => {
    if (country === "US") return /^\d{5}(-\d{4})?$/.test(value)
    if (country === "CA") return /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i.test(value)
    return true
  },
  postcodeValidatorExistsForCountry: (country: string) => {
    return ["US", "CA"].includes(country)
  },
}))

jest.mock("@app/utils/country-region-data", () => ({
  getCountryLabel: (code: string) => {
    const labels: Record<string, string> = {
      US: "United States",
      CA: "Canada",
    }
    return labels[code] ?? code
  },
}))

const ERROR_MESSAGE = "Invalid"

describe("address utils", () => {
  describe("validatePOBox", () => {
    it("detects 'P.O. Box'", () => {
      expect(validatePOBox({ value: "P.O. Box 123", errorMessage: ERROR_MESSAGE })).toBe(
        ERROR_MESSAGE,
      )
    })

    it("detects 'PO Box'", () => {
      expect(validatePOBox({ value: "PO Box 456", errorMessage: ERROR_MESSAGE })).toBe(
        ERROR_MESSAGE,
      )
    })

    it("detects 'P O Box'", () => {
      expect(validatePOBox({ value: "P O Box 789", errorMessage: ERROR_MESSAGE })).toBe(
        ERROR_MESSAGE,
      )
    })

    it("detects 'Post Office Box'", () => {
      expect(
        validatePOBox({ value: "Post Office Box 100", errorMessage: ERROR_MESSAGE }),
      ).toBe(ERROR_MESSAGE)
    })

    it("detects 'POB'", () => {
      expect(validatePOBox({ value: "POB 200", errorMessage: ERROR_MESSAGE })).toBe(
        ERROR_MESSAGE,
      )
    })

    it("is case-insensitive", () => {
      expect(validatePOBox({ value: "p.o. box 123", errorMessage: ERROR_MESSAGE })).toBe(
        ERROR_MESSAGE,
      )
    })

    it("detects French 'Boîte postale'", () => {
      expect(
        validatePOBox({ value: "Boîte postale 42", errorMessage: ERROR_MESSAGE }),
      ).toBe(ERROR_MESSAGE)
    })

    it("detects Spanish 'Apartado'", () => {
      expect(
        validatePOBox({ value: "Apartado postal 100", errorMessage: ERROR_MESSAGE }),
      ).toBe(ERROR_MESSAGE)
    })

    it("detects German 'Postfach'", () => {
      expect(
        validatePOBox({
          value: "Postfach 1234",
          errorMessage: ERROR_MESSAGE,
        }),
      ).toBe(ERROR_MESSAGE)
    })

    it("returns undefined for regular addresses", () => {
      expect(
        validatePOBox({ value: "123 Main Street", errorMessage: ERROR_MESSAGE }),
      ).toBeUndefined()
    })

    it("returns undefined for empty string", () => {
      expect(validatePOBox({ value: "", errorMessage: ERROR_MESSAGE })).toBeUndefined()
    })
  })

  describe("validatePostalCode", () => {
    it("returns undefined for valid US postal code", () => {
      expect(
        validatePostalCode({
          value: "10001",
          countryCode: "US",
          errorMessage: ERROR_MESSAGE,
        }),
      ).toBeUndefined()
    })

    it("returns error for invalid US postal code", () => {
      expect(
        validatePostalCode({
          value: "ABCDE",
          countryCode: "US",
          errorMessage: ERROR_MESSAGE,
        }),
      ).toBe(ERROR_MESSAGE)
    })

    it("returns undefined for valid Canadian postal code", () => {
      expect(
        validatePostalCode({
          value: "K1A 0B1",
          countryCode: "CA",
          errorMessage: ERROR_MESSAGE,
        }),
      ).toBeUndefined()
    })

    it("returns error for invalid Canadian postal code", () => {
      expect(
        validatePostalCode({
          value: "12345",
          countryCode: "CA",
          errorMessage: ERROR_MESSAGE,
        }),
      ).toBe(ERROR_MESSAGE)
    })

    it("returns undefined for empty value", () => {
      expect(
        validatePostalCode({
          value: "",
          countryCode: "US",
          errorMessage: ERROR_MESSAGE,
        }),
      ).toBeUndefined()
    })

    it("returns undefined for unsupported country code", () => {
      expect(
        validatePostalCode({
          value: "12345",
          countryCode: "XYZ",
          errorMessage: ERROR_MESSAGE,
        }),
      ).toBeUndefined()
    })
  })

  describe("addressToLines", () => {
    const fullAddress: AddressFields = {
      firstName: "Satoshi",
      lastName: "Nakamoto",
      line1: "123 Main Street",
      line2: "Apt 4B",
      city: "New York",
      region: "NY",
      postalCode: "10001",
      country: "United States",
      countryCode: "US",
    }

    it("returns all lines including full name by default", () => {
      expect(addressToLines(fullAddress)).toEqual([
        "Satoshi Nakamoto",
        "123 Main Street",
        "Apt 4B",
        "New York, NY, 10001",
        "United States",
      ])
    })

    it("excludes full name when includeFullName is false", () => {
      expect(addressToLines(fullAddress, false)).toEqual([
        "123 Main Street",
        "Apt 4B",
        "New York, NY, 10001",
        "United States",
      ])
    })

    it("omits line2 when null", () => {
      const address = { ...fullAddress, line2: null }
      const lines = addressToLines(address)

      expect(lines).not.toContain(null)
      expect(lines).toHaveLength(4)
    })

    it("omits line2 when empty string", () => {
      const address = { ...fullAddress, line2: "" }
      const lines = addressToLines(address)

      expect(lines).not.toContain("")
      expect(lines).toHaveLength(4)
    })

    it("falls back to countryCode label when country is null", () => {
      const address = { ...fullAddress, country: null }
      const lines = addressToLines(address)

      expect(lines[lines.length - 1]).toBe("United States")
    })

    it("handles missing firstName gracefully", () => {
      const address = { ...fullAddress, firstName: null }
      const lines = addressToLines(address)

      expect(lines[0]).toBe("Nakamoto")
    })

    it("handles missing lastName gracefully", () => {
      const address = { ...fullAddress, lastName: null }
      const lines = addressToLines(address)

      expect(lines[0]).toBe("Satoshi")
    })
  })
})
