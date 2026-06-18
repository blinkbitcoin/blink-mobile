import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

describe("BackupScreen.ManualBackup.Phrase.headerTitle", () => {
  it("reads 'Frase de recuperación' in Spanish", () => {
    loadLocale("es")

    expect(i18nObject("es").BackupScreen.ManualBackup.Phrase.headerTitle()).toBe(
      "Frase de recuperación",
    )
  })

  it("keeps 'Backup phrase' in English", () => {
    loadLocale("en")

    expect(i18nObject("en").BackupScreen.ManualBackup.Phrase.headerTitle()).toBe(
      "Backup phrase",
    )
  })
})
