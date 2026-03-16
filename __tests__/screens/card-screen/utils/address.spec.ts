import {
  validateAddress,
  isAddressValid,
  addressToLines,
  AddressFields,
  ValidationMessages,
} from "@app/screens/card-screen/utils/address"
import { ShippingAddress } from "@app/screens/card-screen/types"

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

const messages: ValidationMessages = {
  required: "Required",
  minChars: ({ min }) => `Min ${min} chars`,
  noPOBoxes: "No PO Boxes",
  invalidPostalCode: "Invalid postal code",
}

const validAddress: ShippingAddress = {
  firstName: "Satoshi",
  lastName: "Nakamoto",
  line1: "123 Main Street",
  line2: "",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "US",
}

describe("validateAddress", () => {
  it("returns no errors for a complete valid address", () => {
    const { errors, isValid } = validateAddress(validAddress, messages)
    expect(errors).toEqual({})
    expect(isValid).toBe(true)
  })

  describe("name fields", () => {
    it("flags firstName when too short", () => {
      const { errors } = validateAddress({ ...validAddress, firstName: "S" }, messages)
      expect(errors.firstName).toBe("Min 2 chars")
      expect(errors.lastName).toBeUndefined()
    })

    it("flags lastName when too short", () => {
      const { errors } = validateAddress({ ...validAddress, lastName: "N" }, messages)
      expect(errors.lastName).toBe("Min 2 chars")
      expect(errors.firstName).toBeUndefined()
    })

    it("skips name validation when checkFullName is false", () => {
      const address = { ...validAddress, firstName: "", lastName: "" }
      const { errors, isValid } = validateAddress(address, messages, {
        checkFullName: false,
      })
      expect(errors.firstName).toBeUndefined()
      expect(errors.lastName).toBeUndefined()
      expect(isValid).toBe(true)
    })
  })

  describe("address lines", () => {
    it("flags line1 when too short", () => {
      const { errors } = validateAddress({ ...validAddress, line1: "A" }, messages)
      expect(errors.line1).toBe("Min 2 chars")
    })

    it("flags line1 when it contains a PO Box", () => {
      const { errors } = validateAddress(
        { ...validAddress, line1: "PO Box 123" },
        messages,
      )
      expect(errors.line1).toBe("No PO Boxes")
    })

    it("detects multilingual PO Box patterns in line1", () => {
      const patterns = [
        "P.O. Box 123",
        "Post Office Box 100",
        "Boîte postale 42",
        "Apartado postal 100",
        "Postfach 1234",
      ]
      for (const pattern of patterns) {
        const { errors } = validateAddress({ ...validAddress, line1: pattern }, messages)
        expect(errors.line1).toBe("No PO Boxes")
      }
    })

    it("flags line2 when it contains a PO Box", () => {
      const { errors } = validateAddress(
        { ...validAddress, line2: "P.O. Box 456" },
        messages,
      )
      expect(errors.line2).toBe("No PO Boxes")
    })

    it("does not flag empty line2", () => {
      const { errors } = validateAddress({ ...validAddress, line2: "" }, messages)
      expect(errors.line2).toBeUndefined()
    })
  })

  describe("city", () => {
    it("flags city when too short", () => {
      const { errors } = validateAddress({ ...validAddress, city: "X" }, messages)
      expect(errors.city).toBe("Min 2 chars")
    })
  })

  describe("postal code", () => {
    it("flags postalCode as required when empty for supported country", () => {
      const { errors } = validateAddress({ ...validAddress, postalCode: "" }, messages)
      expect(errors.postalCode).toBe("Required")
    })

    it("flags postalCode as invalid for bad format", () => {
      const { errors } = validateAddress(
        { ...validAddress, postalCode: "ABCDE" },
        messages,
      )
      expect(errors.postalCode).toBe("Invalid postal code")
    })

    it("does not flag empty postalCode for unsupported country", () => {
      const { errors, isValid } = validateAddress(
        { ...validAddress, countryCode: "XYZ", postalCode: "" },
        messages,
      )
      expect(errors.postalCode).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it("does not flag valid postalCode for unsupported country", () => {
      const { errors } = validateAddress(
        { ...validAddress, countryCode: "XYZ", postalCode: "12345" },
        messages,
      )
      expect(errors.postalCode).toBeUndefined()
    })

    it("validates Canadian postal code format", () => {
      const { errors } = validateAddress(
        { ...validAddress, countryCode: "CA", postalCode: "K1A 0B1" },
        messages,
      )
      expect(errors.postalCode).toBeUndefined()
    })

    it("flags invalid Canadian postal code", () => {
      const { errors } = validateAddress(
        { ...validAddress, countryCode: "CA", postalCode: "12345" },
        messages,
      )
      expect(errors.postalCode).toBe("Invalid postal code")
    })
  })

  describe("country", () => {
    it("flags countryCode when empty", () => {
      const { errors } = validateAddress({ ...validAddress, countryCode: "" }, messages)
      expect(errors.countryCode).toBe("Required")
    })
  })

  describe("isPostalCodeRequired", () => {
    it("returns true for supported country", () => {
      const { isPostalCodeRequired } = validateAddress(validAddress, messages)
      expect(isPostalCodeRequired).toBe(true)
    })

    it("returns false for unsupported country", () => {
      const { isPostalCodeRequired } = validateAddress(
        { ...validAddress, countryCode: "XYZ" },
        messages,
      )
      expect(isPostalCodeRequired).toBe(false)
    })
  })

  describe("multiple errors", () => {
    it("flags all invalid fields at once", () => {
      const { errors, isValid } = validateAddress(
        {
          firstName: "",
          lastName: "",
          line1: "PO Box 1",
          line2: "",
          city: "",
          region: "",
          postalCode: "ABCDE",
          countryCode: "US",
        },
        messages,
      )
      expect(errors.firstName).toBeDefined()
      expect(errors.lastName).toBeDefined()
      expect(errors.line1).toBeDefined()
      expect(errors.city).toBeDefined()
      expect(errors.postalCode).toBeDefined()
      expect(isValid).toBe(false)
    })
  })
})

describe("isAddressValid", () => {
  it("returns true for a complete valid address", () => {
    expect(isAddressValid(validAddress)).toBe(true)
  })

  it("returns false when any field is invalid", () => {
    expect(isAddressValid({ ...validAddress, line1: "A" })).toBe(false)
  })

  it("returns true without checking fullName when checkFullName is false", () => {
    const address = { ...validAddress, firstName: "", lastName: "" }
    expect(isAddressValid(address, { checkFullName: false })).toBe(true)
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
