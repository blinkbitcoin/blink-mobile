import en from "@app/i18n/en"
import type { Translations } from "@app/i18n/i18n-types"
import { MIN_PASSWORD_LENGTH, validatePassword } from "@app/utils/validators/password"

describe("validatePassword", () => {
  describe("default minimum-length policy", () => {
    it("accepts a password of exactly the minimum length", () => {
      expect(validatePassword("123456789012").valid).toBe(true)
    })

    it("rejects a password shorter than the minimum length", () => {
      expect(validatePassword("12345678901").valid).toBe(false)
    })

    it("accepts a password longer than the minimum length", () => {
      expect(validatePassword("a-very-long-passphrase").valid).toBe(true)
    })

    it("rejects an empty password", () => {
      expect(validatePassword("").valid).toBe(false)
    })

    it("counts every character, including newlines, toward the length", () => {
      expect(validatePassword("a\nb\nc\nd\ne\nf\n").valid).toBe(true)
    })
  })

  describe("policy constant", () => {
    it("exposes the minimum length the policy enforces", () => {
      expect(MIN_PASSWORD_LENGTH).toBe(12)
      expect(validatePassword("x".repeat(MIN_PASSWORD_LENGTH)).valid).toBe(true)
      expect(validatePassword("x".repeat(MIN_PASSWORD_LENGTH - 1)).valid).toBe(false)
    })

    it("matches the user-facing copy, so validation and copy cannot drift apart", () => {
      const { passwordPlaceholder, passwordTooShort } = (en as Translations).BackupScreen
        .CloudBackup

      expect(passwordPlaceholder).toContain(String(MIN_PASSWORD_LENGTH))
      expect(passwordTooShort).toContain(String(MIN_PASSWORD_LENGTH))
    })
  })
})
