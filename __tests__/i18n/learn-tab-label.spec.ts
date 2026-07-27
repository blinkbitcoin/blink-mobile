import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

// The bottom navigation bar renders this key as its tab title, accessibility label
// and test ID (app/navigation/root-navigator.tsx).
describe("EarnScreen.title bottom bar label", () => {
  it("reads 'Learn' in English", () => {
    loadLocale("en")

    expect(i18nObject("en").EarnScreen.title()).toBe("Learn")
  })

  it("reads 'Aprender' in Spanish", () => {
    loadLocale("es")

    expect(i18nObject("es").EarnScreen.title()).toBe("Aprender")
  })
})
