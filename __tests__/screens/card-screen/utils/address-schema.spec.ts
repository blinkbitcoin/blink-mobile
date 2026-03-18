import { buildAddressSchema } from "@app/screens/card-screen/utils/address-schema"

jest.mock(
  "@app/utils/address-metadata",
  () =>
    jest.requireActual<typeof import("../helpers/mock-address-metadata")>(
      "../helpers/mock-address-metadata",
    ).mockAddressMetadata,
)

describe("buildAddressSchema", () => {
  describe("US (ACSZ)", () => {
    it("requires address, city, state, and postal code", () => {
      const schema = buildAddressSchema("US")

      expect(schema.fields.line1.required).toBe(true)
      expect(schema.fields.city.required).toBe(true)
      expect(schema.fields.region.required).toBe(true)
      expect(schema.fields.postalCode.required).toBe(true)
    })

    it("sets postal code pattern from metadata", () => {
      const schema = buildAddressSchema("US")

      expect(schema.fields.postalCode.pattern).toBeInstanceOf(RegExp)
      expect(schema.fields.postalCode.pattern!.test("10001")).toBe(true)
      expect(schema.fields.postalCode.pattern!.test("ABCDE")).toBe(false)
    })

    it("returns state/zip name types", () => {
      const schema = buildAddressSchema("US")

      expect(schema.stateNameType).toBe("state")
      expect(schema.postalNameType).toBe("zip")
    })

    it("has regions", () => {
      expect(buildAddressSchema("US").hasRegions).toBe(true)
    })
  })

  describe("SV (ACS — no postal)", () => {
    it("does not require postal code", () => {
      const schema = buildAddressSchema("SV")

      expect(schema.fields.postalCode.required).toBe(false)
    })

    it("has no postal code pattern", () => {
      const schema = buildAddressSchema("SV")

      expect(schema.fields.postalCode.pattern).toBeUndefined()
    })

    it("requires address, city, and state", () => {
      const schema = buildAddressSchema("SV")

      expect(schema.fields.line1.required).toBe(true)
      expect(schema.fields.city.required).toBe(true)
      expect(schema.fields.region.required).toBe(true)
    })
  })

  describe("JP (ASZ — no city required)", () => {
    it("does not require city", () => {
      expect(buildAddressSchema("JP").fields.city.required).toBe(false)
    })

    it("requires state and postal code", () => {
      const schema = buildAddressSchema("JP")

      expect(schema.fields.region.required).toBe(true)
      expect(schema.fields.postalCode.required).toBe(true)
    })

    it("returns prefecture as state name type", () => {
      expect(buildAddressSchema("JP").stateNameType).toBe("prefecture")
    })
  })

  describe("GB (ACZ — no state)", () => {
    it("does not require state", () => {
      expect(buildAddressSchema("GB").fields.region.required).toBe(false)
    })

    it("has no regions", () => {
      expect(buildAddressSchema("GB").hasRegions).toBe(false)
    })
  })

  describe("ZZ fallback (unknown country)", () => {
    it("falls back to ZZ metadata for unknown country", () => {
      const schema = buildAddressSchema("XYZ")

      expect(schema.fields.line1.required).toBe(true)
      expect(schema.fields.city.required).toBe(true)
      expect(schema.fields.postalCode.required).toBe(false)
    })
  })

  describe("common rules", () => {
    it("always requires firstName and lastName with minLength 2", () => {
      const schema = buildAddressSchema("US")

      expect(schema.fields.firstName).toEqual({ required: true, minLength: 2 })
      expect(schema.fields.lastName).toEqual({ required: true, minLength: 2 })
    })

    it("always requires countryCode", () => {
      expect(buildAddressSchema("US").fields.countryCode.required).toBe(true)
    })

    it("sets noPOBox on line1 and line2", () => {
      const schema = buildAddressSchema("US")

      expect(schema.fields.line1.noPOBox).toBe(true)
      expect(schema.fields.line2.noPOBox).toBe(true)
    })

    it("never requires line2", () => {
      expect(buildAddressSchema("US").fields.line2.required).toBe(false)
    })

    it("sets minLength 1 on line1 and city", () => {
      const schema = buildAddressSchema("US")

      expect(schema.fields.line1.minLength).toBe(1)
      expect(schema.fields.city.minLength).toBe(1)
    })

    it("sets enum on region for countries with subdivisions", () => {
      const schema = buildAddressSchema("US")

      expect(schema.fields.region.enum).toEqual(["NY", "CA"])
    })

    it("does not set enum on region for countries without subdivisions", () => {
      const schema = buildAddressSchema("GB")

      expect(schema.fields.region.enum).toBeUndefined()
    })
  })
})
