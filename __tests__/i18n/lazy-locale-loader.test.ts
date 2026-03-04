import { isLocaleLoaded, ensureLocaleLoaded, createLazySetLocale } from "@app/i18n/lazy-locale-loader"
import { loadedLocales } from "@app/i18n/i18n-util"
import { loadLocaleAsync } from "@app/i18n/i18n-util.async"
import type { Locales } from "@app/i18n/i18n-types"

jest.mock("@app/i18n/i18n-util.async", () => ({
  loadLocaleAsync: jest.fn().mockResolvedValue(undefined),
}))

// Partially mock i18n-util to control loadedLocales
jest.mock("@app/i18n/i18n-util", () => {
  const actual = jest.requireActual("@app/i18n/i18n-util")
  return {
    ...actual,
    loadedLocales: {} as Record<string, unknown>,
  }
})

const mockedLoadLocaleAsync = loadLocaleAsync as jest.MockedFunction<typeof loadLocaleAsync>

describe("lazy-locale-loader", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset loadedLocales
    for (const key of Object.keys(loadedLocales)) {
      delete (loadedLocales as Record<string, unknown>)[key]
    }
  })

  describe("isLocaleLoaded", () => {
    it("returns false for an unloaded locale", () => {
      expect(isLocaleLoaded("fr" as Locales)).toBe(false)
    })

    it("returns true for a loaded locale", () => {
      ;(loadedLocales as Record<string, unknown>)["fr"] = { someKey: "value" }
      expect(isLocaleLoaded("fr" as Locales)).toBe(true)
    })
  })

  describe("ensureLocaleLoaded", () => {
    it("calls loadLocaleAsync for an unloaded locale", async () => {
      await ensureLocaleLoaded("de" as Locales)
      expect(mockedLoadLocaleAsync).toHaveBeenCalledWith("de")
    })

    it("skips loadLocaleAsync if locale is already loaded", async () => {
      ;(loadedLocales as Record<string, unknown>)["de"] = { someKey: "value" }
      await ensureLocaleLoaded("de" as Locales)
      expect(mockedLoadLocaleAsync).not.toHaveBeenCalled()
    })
  })

  describe("createLazySetLocale", () => {
    it("loads the locale then calls the original setLocale", async () => {
      const mockSetLocale = jest.fn()
      const lazySetLocale = createLazySetLocale(mockSetLocale)

      await lazySetLocale("ja" as Locales)

      expect(mockedLoadLocaleAsync).toHaveBeenCalledWith("ja")
      expect(mockSetLocale).toHaveBeenCalledWith("ja")
    })

    it("calls setLocale even if locale is already loaded (no-op load)", async () => {
      ;(loadedLocales as Record<string, unknown>)["es"] = { someKey: "value" }
      const mockSetLocale = jest.fn()
      const lazySetLocale = createLazySetLocale(mockSetLocale)

      await lazySetLocale("es" as Locales)

      expect(mockedLoadLocaleAsync).not.toHaveBeenCalled()
      expect(mockSetLocale).toHaveBeenCalledWith("es")
    })
  })
})
