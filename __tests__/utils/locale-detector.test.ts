import {
  detectDefaultCurrency,
  detectDefaultLocale,
  getLanguageFromString,
  getLocaleFromLanguage,
  matchOsLocaleToSupportedLocale,
} from "../../app/utils/locale-detector"

type OsLocale = {
  countryCode: string
  languageTag: string
  languageCode: string
  isRTL: boolean
}

const mockGetCurrencies = jest.fn<string[], []>()
const mockGetLocales = jest.fn<OsLocale[], []>()
jest.mock("react-native-localize", () => ({
  getCurrencies: () => mockGetCurrencies(),
  getLocales: () => mockGetLocales(),
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

describe("detectDefaultLocale", () => {
  it("reads the locale the OS reports", () => {
    mockGetLocales.mockReturnValue([
      { countryCode: "CA", languageTag: "fr-CA", languageCode: "fr", isRTL: false },
    ])

    expect(detectDefaultLocale()).toBe("fr")
  })

  it("falls back to english when the OS reports nothing", () => {
    mockGetLocales.mockReturnValue([])

    expect(detectDefaultLocale()).toBe("en")
  })
})

describe("getLanguageFromString", () => {
  it("treats a missing language as the OS default", () => {
    expect(getLanguageFromString()).toBe("DEFAULT")
  })

  it("keeps a language the app supports", () => {
    expect(getLanguageFromString("es")).toBe("es")
  })

  it("accepts the region-tagged values written server side before", () => {
    expect(getLanguageFromString("pt-BR")).toBe("pt")
  })

  it("treats an unsupported language as the OS default", () => {
    expect(getLanguageFromString("na-XY")).toBe("DEFAULT")
  })
})

describe("getLocaleFromLanguage", () => {
  it("resolves DEFAULT against the OS", () => {
    mockGetLocales.mockReturnValue([
      { countryCode: "SV", languageTag: "es-SV", languageCode: "es", isRTL: false },
    ])

    expect(getLocaleFromLanguage("DEFAULT")).toBe("es")
  })

  it("returns a chosen language untouched", () => {
    expect(getLocaleFromLanguage("fr")).toBe("fr")
  })
})
