import fs from "fs"
import path from "path"

import en from "@app/i18n/en"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

loadLocale("en")
const LL = i18nObject("en")

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

type AnyTranslation = Record<string, unknown>

const collectValues = (node: unknown, prefix = ""): { path: string; value: string }[] => {
  if (typeof node === "string") return [{ path: prefix, value: node }]
  if (node === null || typeof node !== "object") return []
  const obj = node as AnyTranslation
  return Object.keys(obj).flatMap((key) =>
    collectValues(obj[key], prefix ? `${prefix}.${key}` : key),
  )
}

/**
 * Every user-facing string of the encrypted cloud backup flow, on both ends: the two
 * steps of the backup screen and the restore screen that asks for the secret back.
 * `BackupScreen.BackupMethod` is deliberately outside this set — see the last test.
 */
const encryptionFlow = (translation: AnyTranslation) => [
  ...collectValues(
    (translation.BackupScreen as AnyTranslation | undefined)?.CloudBackup,
    "BackupScreen.CloudBackup",
  ),
  ...collectValues(translation.RestoreScreen, "RestoreScreen"),
]

const isPassword = ({ value }: { value: string }) => /password/i.test(value)

const localeFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()

/**
 * The secret that encrypts a cloud backup is a passphrase, not a password. The word is
 * doing deliberate work: "password" invites the user to reuse an account credential,
 * which is the one thing they must not do here, so the copy names something they have
 * never been asked for before. These assert the values rather than the keys — the keys
 * deliberately kept their old names, so a test written against `LL...password()` would
 * still pass if the copy regressed.
 */
describe("cloud backup encryption passphrase copy", () => {
  it("asks to add a passphrase rather than to encrypt with a password", () => {
    expect(LL.BackupScreen.CloudBackup.encryptCheckbox()).toBe(
      "Add additional passphrase",
    )
  })

  it("labels both entry fields as a passphrase", () => {
    expect(LL.BackupScreen.CloudBackup.password()).toBe("Passphrase")
    expect(LL.BackupScreen.CloudBackup.confirmPassword()).toBe("Confirm passphrase")
    expect(LL.BackupScreen.CloudBackup.confirmPasswordPlaceholder()).toBe(
      "Enter passphrase again",
    )
  })

  it("warns that the passphrase is not stored", () => {
    expect(
      LL.BackupScreen.CloudBackup.importantMessage({ bold: "we will not be able" }),
    ).toBe(
      "Blink does not store this passphrase. If you lose it, we will not be able to recover your wallet.",
    )
  })

  it("reports a mismatch between passphrases", () => {
    expect(LL.BackupScreen.CloudBackup.passwordMismatch()).toBe(
      "Passphrases do not match",
    )
  })

  it("asks for the passphrase on restore", () => {
    expect(LL.RestoreScreen.enterPassword()).toBe("Enter your encryption passphrase")
    expect(LL.RestoreScreen.wrongPassword()).toBe(
      "Incorrect passphrase. Please try again.",
    )
  })

  /** The length rules never named the secret, so they are unaffected by the rename. */
  it("leaves the length rules alone", () => {
    expect(LL.BackupScreen.CloudBackup.passwordPlaceholder()).toBe(
      "(12 characters minimum)",
    )
    expect(LL.BackupScreen.CloudBackup.passwordTooShort()).toBe("Minimum 12 characters")
  })

  it("never says 'password' anywhere in the English backup or restore flow", () => {
    expect(encryptionFlow(en as AnyTranslation).filter(isPassword)).toEqual([])
  })

  /**
   * Each locale names the secret in its own language, which no English-language check can
   * verify — those terms are reviewed by hand. What this does catch is the English word
   * surviving in a translation, which is how the rename was missed outside `en` once
   * already.
   */
  localeFiles.forEach((localeFile) => {
    it(`does not leave the English word 'password' in ${localeFile}`, () => {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
      ) as AnyTranslation

      expect(encryptionFlow(parsed).filter(isPassword)).toEqual([])
    })
  })

  /**
   * The backup-method screen offers a real password manager (iOS Keychain / Android
   * autofill) as a destination. That is an actual password manager, so it keeps the word.
   */
  it("still calls the password manager a password manager", () => {
    const backupMethod = (en as AnyTranslation).BackupScreen as AnyTranslation
    const method = backupMethod.BackupMethod as AnyTranslation

    expect(method.passwordManager).toBe("Password manager")
    expect(method.passwordManagerBackupSaved).toBe("Backup saved to password manager")
    expect(method.passwordManagerUnavailable).toBe(
      "No password manager available on this device. Use Drive backup or save your 12-word phrase manually.",
    )
  })
})
