import {
  detectDefaultCurrency,
  matchOsLocaleToSupportedLocale,
} from "../../app/utils/locale-detector"

const mockGetCurrencies = jest.fn<string[], []>()
jest.mock("react-native-localize", () => ({
  getCurrencies: () => mockGetCurrencies(),
  getLocales: () => [],
}))

describe("matchOsLocaleToSupportedLocale", () => {
  it("exactly matches a supported locale", () => {
    const supportedCountyAndLang = [
      { countryCode: "CA", languageTag: "fr-CA", languageCode: "fr", isRTL: false },
    ]
    const locale = matchOsLocaleToSupportedLocale(supportedCountyAndLang)
    expect(locale).toEqual("fr")
  })

  it("approximately matches a supported locale", () => {
    const unsupportedCountrySupportedLang = [
      { countryCode: "SV", languageTag: "es-SV", languageCode: "es", isRTL: false },
    ]
    const locale = matchOsLocaleToSupportedLocale(unsupportedCountrySupportedLang)
    expect(locale).toEqual("es")
  })

  it("returns english when there is no locale match", () => {
    const unsupportedCountryAndLang = [
      { countryCode: "XY", languageTag: "na-XY", languageCode: "na", isRTL: false },
    ]
    const locale = matchOsLocaleToSupportedLocale(unsupportedCountryAndLang)
    expect(locale).toEqual("en")
  })
})

describe("detectDefaultCurrency", () => {
  const supportedCurrencyIds = ["USD", "EUR", "GBP", "CRC"]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the currency the device prefers", () => {
    mockGetCurrencies.mockReturnValue(["CRC", "USD"])

    expect(detectDefaultCurrency(supportedCurrencyIds)).toBe("CRC")
  })

  it("takes the next device currency when the preferred one cannot be priced", () => {
    mockGetCurrencies.mockReturnValue(["XBT", "GBP"])

    expect(detectDefaultCurrency(supportedCurrencyIds)).toBe("GBP")
  })

  it("returns undefined when no device currency can be priced", () => {
    mockGetCurrencies.mockReturnValue(["XBT", "XAU"])

    expect(detectDefaultCurrency(supportedCurrencyIds)).toBeUndefined()
  })

  it("returns undefined when the device names no currency", () => {
    mockGetCurrencies.mockReturnValue([])

    expect(detectDefaultCurrency(supportedCurrencyIds)).toBeUndefined()
  })

  it("returns undefined when nothing is known to be priceable yet", () => {
    mockGetCurrencies.mockReturnValue(["CRC"])

    expect(detectDefaultCurrency([])).toBeUndefined()
  })
})
