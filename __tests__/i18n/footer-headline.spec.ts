import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

describe("GetStartedScreen.headline", () => {
  it("reads 'Wallet powered by Blink' in English", () => {
    loadLocale("en")

    expect(i18nObject("en").GetStartedScreen.headline()).toBe("Wallet powered by Blink")
  })

  it("reads 'Billetera desarrollada por Blink' in Spanish", () => {
    loadLocale("es")

    expect(i18nObject("es").GetStartedScreen.headline()).toBe(
      "Billetera desarrollada por Blink",
    )
  })

  it("reads 'Portofel oferit de Blink' in Romanian", () => {
    loadLocale("ro")

    expect(i18nObject("ro").GetStartedScreen.headline()).toBe("Portofel oferit de Blink")
  })
})
