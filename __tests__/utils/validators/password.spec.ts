import { validatePassword } from "@app/utils/validators/password"

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

  describe("custom policy regex", () => {
    it("validates against the provided pattern instead of the default", () => {
      const requiresDigit = /\d/

      expect(validatePassword("abc1", requiresDigit).valid).toBe(true)
      expect(validatePassword("abcd", requiresDigit).valid).toBe(false)
    })
  })
})
