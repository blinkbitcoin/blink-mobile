import fs from "fs"
import path from "path"

import { describe, expect, it } from "@jest/globals"

/**
 * The signing step words its failures itself, since the library's copy is English only.
 * Every locale has to carry every code the step words, and none may fall back to the
 * English string: a Spanish investor read "Error", an English sentence, then "Intentar
 * de nuevo" on the screen where they commit to an investment. The parity spec only
 * checks that the keys exist; this one checks they are translated.
 */
const RAW_I18N_DIR = path.resolve(__dirname, "..", "..", "app", "i18n", "raw-i18n")
const TRANSLATIONS_DIR = path.join(RAW_I18N_DIR, "translations")
const SOURCE_FILE = path.join(RAW_I18N_DIR, "source", "en.json")

type SignInvestCopy = {
  loading: string
  notAvailable: string
  errors: Record<string, string>
}

const readSignInvestCopy = (file: string): SignInvestCopy =>
  JSON.parse(fs.readFileSync(file, "utf8")).CardFlow.Onboarding.SignInvest

const ERROR_CODES_WORDED = [
  "envelopeCreationFailed",
  "networkError",
  "unauthorized",
  "sessionExpired",
  "providerUnavailable",
  "routeMissing",
  "envelopeMismatch",
  "generic",
]

describe("the signing step's copy", () => {
  const english = readSignInvestCopy(SOURCE_FILE)
  const locales = fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))

  it("words every failure code the step knows", () => {
    expect(Object.keys(english.errors).sort()).toEqual([...ERROR_CODES_WORDED].sort())
  })

  it.each(locales)("is translated in %s, not left in English", (locale) => {
    const copy = readSignInvestCopy(path.join(TRANSLATIONS_DIR, `${locale}.json`))

    expect(copy.loading).toBeTruthy()
    expect(copy.loading).not.toBe(english.loading)
    expect(copy.notAvailable).toBeTruthy()
    expect(copy.notAvailable).not.toBe(english.notAvailable)
    for (const code of ERROR_CODES_WORDED) {
      expect(copy.errors[code]).toBeTruthy()
      expect(copy.errors[code]).not.toBe(english.errors[code])
    }
  })
})
