import { OpeningState, openingStateAt } from "@app/btcmap/opening-hours"

// 2026-08-12 is a Wednesday. Local time, which is what the evaluator reads.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 7, 9 + day, hour, minute) // 2026-08-09 is a Sunday, so day 0 = Sunday

describe("openingStateAt", () => {
  it("treats a missing or unparseable spec as unknown rather than closed", () => {
    expect(openingStateAt(undefined, at(3, 12))).toBe(OpeningState.Unknown)
    expect(openingStateAt("", at(3, 12))).toBe(OpeningState.Unknown)
    expect(openingStateAt("ALL TIME", at(3, 12))).toBe(OpeningState.Unknown)
  })

  it("reads 24/7 as always open", () => {
    expect(openingStateAt("24/7", at(0, 3))).toBe(OpeningState.Open)
    expect(openingStateAt("24/7", at(4, 23, 59))).toBe(OpeningState.Open)
  })

  it("reads a weekday range with one time range", () => {
    const hours = "Mo-Fr 09:00-17:00"
    expect(openingStateAt(hours, at(1, 8, 59))).toBe(OpeningState.Closed)
    expect(openingStateAt(hours, at(1, 9))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(5, 16, 59))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(5, 17))).toBe(OpeningState.Closed)
    expect(openingStateAt(hours, at(6, 12))).toBe(OpeningState.Closed)
  })

  it("reads split hours listed with a comma", () => {
    const hours = "Mo-Fr 09:00-12:00,13:00-18:00"
    expect(openingStateAt(hours, at(3, 11))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(3, 12, 30))).toBe(OpeningState.Closed)
    expect(openingStateAt(hours, at(3, 14))).toBe(OpeningState.Open)
  })

  it("reads a day list that happens to use the same comma", () => {
    const hours = "Tu,Sa 09:00-13:30"
    expect(openingStateAt(hours, at(2, 10))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(6, 10))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(3, 10))).toBe(OpeningState.Closed)
  })

  it("takes a comma between two dated rules as a union, not a replacement", () => {
    // Mappers write this where the spec wants a semicolon; Saturday must not
    // wipe out the weekday hours.
    const hours = "Mo-Fr 08:00-17:00, Sa 08:00-12:00"
    expect(openingStateAt(hours, at(1, 9))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(6, 9))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(6, 13))).toBe(OpeningState.Closed)
  })

  it("lets a later semicolon rule close a day the earlier one opened", () => {
    const hours = "Mo-Fr 09:00-17:00; We off"
    expect(openingStateAt(hours, at(2, 12))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(3, 12))).toBe(OpeningState.Closed)
  })

  it("carries an overnight range into the small hours of the next day", () => {
    const hours = "Mo-Su 18:00-02:00"
    expect(openingStateAt(hours, at(3, 19))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(4, 1))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(4, 3))).toBe(OpeningState.Closed)
  })

  it("reads a range ending at midnight as closing at the end of the day", () => {
    const hours = "Mo-Su 10:00-00:00"
    expect(openingStateAt(hours, at(3, 23, 59))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(3, 9))).toBe(OpeningState.Closed)
  })

  it("handles a weekday range that wraps past Sunday", () => {
    const hours = "Fr-Mo 10:00-16:00"
    expect(openingStateAt(hours, at(5, 12))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(0, 12))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(1, 12))).toBe(OpeningState.Open)
    expect(openingStateAt(hours, at(3, 12))).toBe(OpeningState.Closed)
  })

  it("abstains on the syntax it cannot evaluate instead of guessing", () => {
    const cases = [
      '"By appointment"',
      "Mo-Fr 09:00-17:00; PH off",
      "May-Oct Sa,Su 12:00-19:00",
      "sunrise-sunset",
      "Mo[1] 09:00-17:00",
      "Mo-Su,PH 00:00+",
      // Legal OSM, but an end past midnight is easy to get wrong.
      "Mo-Su 09:30-24:30",
      // The spec says "every day", the mapper meant "the days above".
      "Mo-Fr 08:30-12:30; 17:00-20:30",
      "Mo-Su",
      // Long and three-letter weekday names are outside the two-letter subset
      // this was validated against, so they abstain rather than be guessed at.
      "Monday 09:00-17:00",
      "Sat 09:00-13:00",
    ]

    for (const spec of cases) {
      expect(openingStateAt(spec, at(3, 12))).toBe(OpeningState.Unknown)
    }
  })

  it("is case-insensitive about weekday names", () => {
    expect(openingStateAt("MO-FR 09:00-17:00", at(1, 12))).toBe(OpeningState.Open)
    expect(openingStateAt("mo-fr 09:00-17:00", at(1, 12))).toBe(OpeningState.Open)
  })
})
