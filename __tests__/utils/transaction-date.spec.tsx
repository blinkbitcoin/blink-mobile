import { formatDateForTransaction } from "@app/components/transaction-date"
import * as dateUtils from "@app/utils/date"

jest.mock("@app/utils/date", () => ({
  ...jest.requireActual("@app/utils/date"),
  isToday: jest.fn(),
  isYesterday: jest.fn(),
}))

const mockedIsToday = dateUtils.isToday as jest.Mock
const mockedIsYesterday = dateUtils.isYesterday as jest.Mock

describe("formatDateForTransaction", () => {
  beforeEach(() => {
    mockedIsToday.mockReset()
    mockedIsYesterday.mockReset()
  })

  it("should return short date format for older transactions", () => {
    mockedIsToday.mockReturnValue(false)
    mockedIsYesterday.mockReturnValue(false)

    const createdAt = 1620849600
    const timezone = "America/El_Salvador"
    const locale = "en"

    expect(
      formatDateForTransaction({ createdAt, locale, timezone, includeTime: false }),
    ).toEqual("2021-05-12")
  })

  it("should return short date format regardless of language", () => {
    mockedIsToday.mockReturnValue(false)
    mockedIsYesterday.mockReturnValue(false)

    const createdAt = 1620849600
    const locale = "es"
    const timezone = "America/El_Salvador"

    expect(
      formatDateForTransaction({ createdAt, locale, timezone, includeTime: false }),
    ).toEqual("2021-05-12")
  })

  it("if tx is from 2h ago and is today, use relative time instead", () => {
    mockedIsToday.mockReturnValue(true)
    mockedIsYesterday.mockReturnValue(false)

    const createdAt = 1620849600
    const now = (1620849600 + 60 * 60 * 2) * 1000
    const locale = "es"

    expect(
      formatDateForTransaction({ createdAt, locale, includeTime: false, now }),
    ).toEqual("hace 2 horas")
  })

  it("if tx is from 5 seconds ago and is today, use relative time instead", () => {
    mockedIsToday.mockReturnValue(true)
    mockedIsYesterday.mockReturnValue(false)

    const createdAt = 1620849600
    const now = (1620849600 + 5) * 1000
    const locale = "en"

    expect(
      formatDateForTransaction({ createdAt, locale, includeTime: false, now }),
    ).toEqual("5 seconds ago")
  })

  it("if tx is from yesterday, use hours instead of day", () => {
    mockedIsToday.mockReturnValue(false)
    mockedIsYesterday.mockReturnValue(true)

    const createdAt = 1620849600
    const now = (1620849600 + 60 * 60 * 26) * 1000
    const locale = "en"

    expect(
      formatDateForTransaction({ createdAt, locale, includeTime: false, now }),
    ).toEqual("26 hours ago")
  })

  it("if tx is from yesterday and under a minute, use seconds", () => {
    mockedIsToday.mockReturnValue(false)
    mockedIsYesterday.mockReturnValue(true)

    const createdAt = 1620849600
    const now = (1620849600 + 30) * 1000
    const locale = "en"

    expect(
      formatDateForTransaction({ createdAt, locale, includeTime: false, now }),
    ).toEqual("30 seconds ago")
  })

  it("if tx is from yesterday and under an hour, use minutes", () => {
    mockedIsToday.mockReturnValue(false)
    mockedIsYesterday.mockReturnValue(true)

    const createdAt = 1620849600
    const now = (1620849600 + 60 * 25) * 1000
    const locale = "en"

    expect(
      formatDateForTransaction({ createdAt, locale, includeTime: false, now }),
    ).toEqual("25 minutes ago")
  })
})
