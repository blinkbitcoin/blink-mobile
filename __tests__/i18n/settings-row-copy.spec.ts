import fs from "fs"
import path from "path"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

const ENGLISH = {
  backupTitle: "Back up your wallet",
  downloadLogs: "Download logs",
  exportLogsTitle: "Share your wallet logs",
  exportLogsConfirm: "Share logs",
  noLogsYet: "There are no logs to share yet. Open your wallet and try again.",
  exportLogsError: "Couldn't export your logs. Please try again.",
} as const

const locales = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""))

const stringsFor = (locale: string) => {
  const raw = JSON.parse(
    fs.readFileSync(path.join(TRANSLATIONS_DIR, `${locale}.json`), "utf8"),
  )

  return {
    backupTitle: raw.BackupScreen?.title as unknown,
    downloadLogs: raw.support?.downloadLogs as unknown,
    exportLogsTitle: raw.support?.exportLogsTitle as unknown,
    exportLogsBody: raw.support?.exportLogsBody as unknown,
    exportLogsConfirm: raw.support?.exportLogsConfirm as unknown,
    noLogsYet: raw.support?.noLogsYet as unknown,
    exportLogsError: raw.support?.exportLogsError as unknown,
  }
}

describe("settings rows that stayed in English", () => {
  it("keeps the English source", () => {
    loadLocale("en")
    const LL = i18nObject("en")

    expect(LL.BackupScreen.title()).toBe(ENGLISH.backupTitle)
    expect(LL.support.downloadLogs()).toBe(ENGLISH.downloadLogs)
  })

  it("reads the Spanish settings rows", () => {
    loadLocale("es")
    const LL = i18nObject("es")

    expect(LL.BackupScreen.title()).toBe("Respaldar tu billetera")
    expect(LL.support.downloadLogs()).toBe("Descargar registros")
    expect(LL.support.exportLogsConfirm()).toBe("Compartir registros")
  })

  locales.forEach((locale) => {
    it(`does not fall back to English in ${locale}`, () => {
      const strings = stringsFor(locale)

      expect(strings.backupTitle).not.toBe(ENGLISH.backupTitle)
      expect(strings.downloadLogs).not.toBe(ENGLISH.downloadLogs)
      expect(strings.exportLogsTitle).not.toBe(ENGLISH.exportLogsTitle)
      expect(strings.exportLogsConfirm).not.toBe(ENGLISH.exportLogsConfirm)
      expect(strings.noLogsYet).not.toBe(ENGLISH.noLogsYet)
      expect(strings.exportLogsError).not.toBe(ENGLISH.exportLogsError)
      expect(typeof strings.exportLogsBody).toBe("string")
      expect(String(strings.exportLogsBody)).not.toContain(
        "This file helps our support team",
      )
    })
  })
})
