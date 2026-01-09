import {
  formatBtcWithSuffix,
  findBtcSuffixIndex,
  BTC_SUFFIX,
} from "@app/screens/conversion-flow/btc-format"

describe("btc-format", () => {
  describe("formatBtcWithSuffix", () => {
    it("returns empty string when digits is empty", () => {
      expect(formatBtcWithSuffix("")).toBe("")
    })

    it("returns formatted string with SAT suffix", () => {
      expect(formatBtcWithSuffix("100")).toBe("100 SAT")
    })

    it("returns formatted string with comma-separated digits", () => {
      expect(formatBtcWithSuffix("1,000")).toBe("1,000 SAT")
    })

    it("returns formatted string with decimal digits", () => {
      expect(formatBtcWithSuffix("100.50")).toBe("100.50 SAT")
    })
  })

  describe("findBtcSuffixIndex", () => {
    it("returns correct index when SAT suffix is present", () => {
      expect(findBtcSuffixIndex("100 SAT")).toBe(3)
    })

    it("returns correct index when sat suffix is lowercase", () => {
      expect(findBtcSuffixIndex("100 sat")).toBe(3)
    })

    it("returns correct index when suffix has mixed case", () => {
      expect(findBtcSuffixIndex("100 Sat")).toBe(3)
    })

    it("returns string length when suffix is not present", () => {
      expect(findBtcSuffixIndex("100")).toBe(3)
    })

    it("returns string length when value is empty", () => {
      expect(findBtcSuffixIndex("")).toBe(0)
    })

    it("returns correct index for large numbers with suffix", () => {
      expect(findBtcSuffixIndex("1,000,000 SAT")).toBe(9)
    })

    it("does not match SAT without space before it", () => {
      expect(findBtcSuffixIndex("100SAT")).toBe(6)
    })
  })

  describe("BTC_SUFFIX", () => {
    it("has correct value", () => {
      expect(BTC_SUFFIX).toBe("SAT")
    })
  })
})
