import en from "@app/i18n/en"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

loadLocale("en")
const LL = i18nObject("en")

type AnyTranslation = Record<string, unknown>

const collectValues = (node: unknown, prefix = ""): string[] => {
  if (typeof node === "string") return [`${prefix}: ${node}`]
  if (node === null || typeof node !== "object") return []
  const obj = node as AnyTranslation
  return Object.keys(obj).flatMap((key) =>
    collectValues(obj[key], prefix ? `${prefix}.${key}` : key),
  )
}

const backupScreen = (en as AnyTranslation).BackupScreen as AnyTranslation
const cloudBackup = backupScreen.CloudBackup
const backupMethod = backupScreen.BackupMethod as AnyTranslation
const restoreScreen = (en as AnyTranslation).RestoreScreen

/**
 * The encryption secret is a passphrase, not a password: it is a BIP-39-style extra
 * phrase on top of the backup phrase, and calling it a "password" reads as an account
 * credential. These assert the values rather than the keys — the keys deliberately kept
 * their old names, so a test written against `LL...password()` would still pass if the
 * copy regressed.
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

  it("never says 'password' anywhere in the backup or restore flow", () => {
    const offenders = [
      ...collectValues(cloudBackup, "BackupScreen.CloudBackup"),
      ...collectValues(restoreScreen, "RestoreScreen"),
    ].filter((entry) => /password/i.test(entry.split(": ").slice(1).join(": ")))

    expect(offenders).toEqual([])
  })

  /**
   * The backup-method screen offers a real password manager (iOS Keychain / Android
   * autofill) as a destination. That is an actual password manager, so it keeps the word.
   */
  it("still calls the password manager a password manager", () => {
    expect(backupMethod.passwordManager).toBe("Password manager")
    expect(backupMethod.passwordManagerBackupSaved).toBe(
      "Backup saved to password manager",
    )
    expect(backupMethod.passwordManagerUnavailable).toBe(
      "No password manager available on this device. Use Drive backup or save your 12-word phrase manually.",
    )
  })
})
