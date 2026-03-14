import {
  getAllCountries,
  getRegionsByCountry,
  getCountryLabel,
} from "@app/utils/country-region-data"

describe("country-region-data", () => {
  describe("getAllCountries", () => {
    it("returns all 249 countries", () => {
      const countries = getAllCountries()

      expect(countries).toHaveLength(249)
    })

    it("returns countries sorted alphabetically by label", () => {
      const countries = getAllCountries()
      const labels = countries.map((c) => c.label)

      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    })

    it("includes United States with code US", () => {
      const countries = getAllCountries()
      const us = countries.find((c) => c.value === "US")

      expect(us).toEqual({ value: "US", label: "United States" })
    })

    it("each country has value and label", () => {
      const countries = getAllCountries()

      for (const c of countries) {
        expect(c.value).toBeTruthy()
        expect(c.label).toBeTruthy()
      }
    })
  })

  describe("getRegionsByCountry", () => {
    it("returns states for the US", () => {
      const regions = getRegionsByCountry("US")

      expect(regions.length).toBeGreaterThan(0)
      expect(regions.find((r) => r.value === "NY")).toEqual({
        value: "NY",
        label: "New York",
      })
    })

    it("returns provinces for Canada", () => {
      const regions = getRegionsByCountry("CA")

      expect(regions.length).toBeGreaterThan(0)
      expect(regions.find((r) => r.value === "ON")).toEqual({
        value: "ON",
        label: "Ontario",
      })
    })

    it("returns empty array for unknown country code", () => {
      expect(getRegionsByCountry("ZZ")).toEqual([])
    })

    it("each region has value and label", () => {
      const regions = getRegionsByCountry("US")

      for (const r of regions) {
        expect(r.value).toBeTruthy()
        expect(r.label).toBeTruthy()
      }
    })
  })

  describe("getCountryLabel", () => {
    it("returns label for known country", () => {
      expect(getCountryLabel("US")).toBe("United States")
      expect(getCountryLabel("CA")).toBe("Canada")
      expect(getCountryLabel("AR")).toBe("Argentina")
    })

    it("falls back to country code for unknown code", () => {
      expect(getCountryLabel("ZZ")).toBe("ZZ")
    })
  })
})
