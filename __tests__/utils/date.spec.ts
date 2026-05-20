import { it } from "@jest/globals"

import {
  formatCardValidThruDisplay,
  formatDateFromNow,
  formatDuration,
  formatMonth,
  formatShortDate,
  getLastDayOfMonth,
  isSameDay,
  isToday,
  isYesterday,
  parseCardValidThru,
} from "@app/utils/date"

describe("date utils", () => {
  describe("isSameDay", () => {
    it.each([
      {
        name: "same calendar day",
        first: new Date(2024, 0, 15, 1, 0, 0),
        second: new Date(2024, 0, 15, 23, 59, 59),
        expected: true,
      },
      {
        name: "different days",
        first: new Date(2024, 0, 15, 23, 59, 59),
        second: new Date(2024, 0, 16, 0, 0, 0),
        expected: false,
      },
      {
        name: "different months",
        first: new Date(2024, 0, 31, 12, 0, 0),
        second: new Date(2024, 1, 1, 12, 0, 0),
        expected: false,
      },
      {
        name: "different years",
        first: new Date(2023, 11, 31, 12, 0, 0),
        second: new Date(2024, 11, 31, 12, 0, 0),
        expected: false,
      },
      {
        name: "midnight vs end of day",
        first: new Date(2024, 5, 10, 0, 0, 0),
        second: new Date(2024, 5, 10, 23, 59, 59),
        expected: true,
      },
      {
        name: "same month different day",
        first: new Date(2024, 5, 10, 12, 0, 0),
        second: new Date(2024, 5, 11, 12, 0, 0),
        expected: false,
      },
      {
        name: "leap day matches",
        first: new Date(2024, 1, 29, 8, 30, 0),
        second: new Date(2024, 1, 29, 22, 15, 0),
        expected: true,
      },
      {
        name: "leap day vs next day",
        first: new Date(2024, 1, 29, 23, 59, 59),
        second: new Date(2024, 2, 1, 0, 0, 0),
        expected: false,
      },
    ])("returns $expected when $name", ({ first, second, expected }) => {
      expect(isSameDay(first, second)).toBe(expected)
    })
  })

  describe("isToday/isYesterday", () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date("2024-01-15T12:00:00Z"))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it.each([
      {
        name: "today timestamp returns true",
        value: () => Math.floor(Date.now() / 1000),
        fn: isToday,
        expected: true,
      },
      {
        name: "yesterday timestamp returns false for today",
        value: () => Math.floor((Date.now() - 86400000) / 1000),
        fn: isToday,
        expected: false,
      },
      {
        name: "yesterday timestamp returns true",
        value: () => Math.floor((Date.now() - 86400000) / 1000),
        fn: isYesterday,
        expected: true,
      },
      {
        name: "today timestamp returns false for yesterday",
        value: () => Math.floor(Date.now() / 1000),
        fn: isYesterday,
        expected: false,
      },
      {
        name: "two days ago returns false for today",
        value: () => Math.floor((Date.now() - 2 * 86400000) / 1000),
        fn: isToday,
        expected: false,
      },
      {
        name: "two days ago returns false for yesterday",
        value: () => Math.floor((Date.now() - 2 * 86400000) / 1000),
        fn: isYesterday,
        expected: false,
      },
      {
        name: "near-midnight today",
        before: () => jest.setSystemTime(new Date("2024-01-15T00:05:00Z")),
        value: () => Math.floor(Date.parse("2024-01-15T00:00:00Z") / 1000),
        fn: isToday,
        expected: true,
      },
      {
        name: "near-midnight yesterday",
        before: () => jest.setSystemTime(new Date("2024-01-15T00:05:00Z")),
        value: () => Math.floor(Date.parse("2024-01-14T00:01:00Z") / 1000),
        fn: isYesterday,
        expected: true,
      },
      {
        name: "just after midnight is not yesterday",
        before: () => jest.setSystemTime(new Date("2024-01-15T00:01:00Z")),
        value: () => Math.floor(Date.parse("2024-01-15T00:00:30Z") / 1000),
        fn: isYesterday,
        expected: false,
      },
    ])("returns $expected when $name", ({ before, value, fn, expected }) => {
      if (before) {
        before()
      }
      expect(fn(value())).toBe(expected)
    })
  })

  describe("formatShortDate", () => {
    it.each([
      {
        name: "formats YYYY-MM-DD in UTC",
        createdAt: Math.floor(Date.parse("2026-01-20T05:00:00Z") / 1000),
        timezone: "UTC",
        expected: "2026-01-20",
      },
      {
        name: "uses leading zeros for month and day",
        createdAt: Math.floor(Date.parse("2024-03-05T12:00:00Z") / 1000),
        timezone: "UTC",
        expected: "2024-03-05",
      },
      {
        name: "rolls back a day for negative timezone offset",
        createdAt: Math.floor(Date.parse("2024-01-01T00:00:00Z") / 1000),
        timezone: "America/Los_Angeles",
        expected: "2023-12-31",
      },
      {
        name: "stays same day for positive timezone offset",
        createdAt: Math.floor(Date.parse("2024-01-01T00:00:00Z") / 1000),
        timezone: "Asia/Tokyo",
        expected: "2024-01-01",
      },
      {
        name: "end of month date",
        createdAt: Math.floor(Date.parse("2024-08-31T23:00:00Z") / 1000),
        timezone: "UTC",
        expected: "2024-08-31",
      },
      {
        name: "leap day formats correctly",
        createdAt: Math.floor(Date.parse("2024-02-29T12:00:00Z") / 1000),
        timezone: "UTC",
        expected: "2024-02-29",
      },
    ])("returns $expected when $name", ({ createdAt, timezone, expected }) => {
      expect(formatShortDate({ createdAt, timezone })).toBe(expected)
    })

    it("defaults to local timezone when none is provided", () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date("2024-06-10T12:00:00Z"))

      const createdAt = Math.floor(Date.parse("2024-06-10T12:00:00Z") / 1000)
      expect(formatShortDate({ createdAt })).toMatch(/2024-06-10/)

      jest.useRealTimers()
    })
  })

  describe("parseCardValidThru", () => {
    it("parses a valid Date instance", () => {
      expect(parseCardValidThru(new Date("2024-05-01T12:00:00Z"))).toEqual({
        month: "05",
        year: "24",
      })
    })

    it("returns null for an invalid Date instance", () => {
      expect(parseCardValidThru(new Date("invalid-date"))).toBeNull()
    })

    it("parses an ISO date string with dashes", () => {
      expect(parseCardValidThru("2024-02-03")).toEqual({ month: "02", year: "24" })
    })

    it("parses an ISO datetime string with a time separator", () => {
      expect(parseCardValidThru("2026-11-30T15:00:00Z")).toEqual({
        month: "11",
        year: "26",
      })
    })

    it("trims whitespace before parsing", () => {
      expect(parseCardValidThru(" 2024-12-09 ")).toEqual({ month: "12", year: "24" })
    })

    it("returns null when the string lacks '-' or 'T'", () => {
      expect(parseCardValidThru("May 01 2024")).toBeNull()
    })
  })

  describe("formatCardValidThruDisplay", () => {
    it("returns empty string when parsing fails", () => {
      expect(formatCardValidThruDisplay("not-a-date", true, "*")).toBe("")
    })

    it("formats with details when showDetails is true", () => {
      expect(formatCardValidThruDisplay("2024-12-05", true, "*")).toBe("12/ 24")
    })

    it("masks when showDetails is false", () => {
      expect(formatCardValidThruDisplay("2024-12-05", false, "#")).toBe("## / ##")
    })

    it("accepts a Date instance as input", () => {
      expect(
        formatCardValidThruDisplay(new Date("2031-01-15T12:00:00Z"), true, "*"),
      ).toBe("01/ 31")
    })
  })

  describe("getLastDayOfMonth", () => {
    it.each([
      { year: 2025, month: 0, expected: 31, name: "January" },
      { year: 2025, month: 1, expected: 28, name: "February (non-leap)" },
      { year: 2024, month: 1, expected: 29, name: "February (leap)" },
      { year: 2025, month: 3, expected: 30, name: "April" },
      { year: 2025, month: 11, expected: 31, name: "December" },
    ])("returns $expected for $name $year", ({ year, month, expected }) => {
      expect(getLastDayOfMonth(year, month)).toBe(expected)
    })
  })

  describe("formatMonth", () => {
    it("returns short month name", () => {
      const date = new Date(2025, 0, 15)
      expect(formatMonth("en", date, "short")).toBe("Jan")
    })

    it("returns long month name", () => {
      const date = new Date(2025, 0, 15)
      expect(formatMonth("en", date, "long")).toBe("January")
    })

    it("respects locale for short month", () => {
      const date = new Date(2025, 0, 15)
      expect(formatMonth("es", date, "short")).toBe("ene")
    })

    it("respects locale for long month", () => {
      const date = new Date(2025, 0, 15)
      expect(formatMonth("es", date, "long")).toBe("enero")
    })
  })

  describe("formatDateFromNow", () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date("2026-03-12T12:00:00Z"))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("returns date 1 year from now", () => {
      expect(formatDateFromNow({ years: 1, locale: "en-US" })).toBe("Mar 12, 2027")
    })

    it("returns date 2 years from now", () => {
      expect(formatDateFromNow({ years: 2, locale: "en-US" })).toBe("Mar 12, 2028")
    })

    it("returns current date for 0 years", () => {
      expect(formatDateFromNow({ years: 0, locale: "en-US" })).toBe("Mar 12, 2026")
    })

    it("handles leap year edge case", () => {
      jest.setSystemTime(new Date("2024-02-29T12:00:00Z"))
      expect(formatDateFromNow({ years: 1, locale: "en-US" })).toBe("Mar 1, 2025")
    })

    it("returns ISO format", () => {
      expect(formatDateFromNow({ years: 5, format: "iso" })).toBe("2031-03-12")
    })
  })

  describe("formatDuration", () => {
    it("formats hours with narrow display", () => {
      expect(formatDuration(24, { locale: "en-US" })).toBe("24h")
    })

    it("formats single hour", () => {
      expect(formatDuration(1, { locale: "en-US" })).toBe("1h")
    })

    it("formats large values", () => {
      expect(formatDuration(72, { locale: "en-US" })).toBe("72h")
    })

    it("defaults to hour and en-US when no options provided", () => {
      expect(formatDuration(48)).toBe("48h")
    })

    it("formats seconds with narrow display", () => {
      expect(formatDuration(10, { unit: "second", locale: "en-US" })).toBe("10s")
    })

    it("formats minutes with narrow display", () => {
      expect(formatDuration(5, { unit: "minute", locale: "en-US" })).toBe("5m")
    })

    it("formats days with narrow display", () => {
      expect(formatDuration(3, { unit: "day", locale: "en-US" })).toBe("3d")
    })
  })
})
