import { PasswordIssue, Strength, validatePassword } from "@app/utils/validators/password"

describe("password validator", () => {
  it("rejects repeated-character passwords", () => {
    const result = validatePassword("aaaaaaaaaaaa")

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(PasswordIssue.TooWeak)
    expect(result.errors).toContain(PasswordIssue.CommonPassword)
    expect(result.strength).toBe(Strength.Weak)
  })

  it("rejects numeric-only passwords", () => {
    const result = validatePassword("123456789012")

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(PasswordIssue.TooWeak)
    expect(result.errors).toContain(PasswordIssue.CommonPassword)
    expect(result.strength).toBe(Strength.Weak)
  })

  it("rejects common passwords even when they meet composition rules", () => {
    const result = validatePassword("password1234!")

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(PasswordIssue.CommonPassword)
    expect(result.strength).toBe(Strength.Fair)
  })

  it("accepts a strong password", () => {
    const result = validatePassword("ValidPass1234!")

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.strength).toBe(Strength.Fair)
  })

  it("reports short passwords with the expected error set", () => {
    const result = validatePassword("Short1!")

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(PasswordIssue.TooShort)
    expect(result.strength).toBe(Strength.Weak)
  })

  it("reports stronger passwords as strong when length and classes are high enough", () => {
    const result = validatePassword("LongerValidPass1234!")

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.strength).toBe(Strength.Strong)
  })
})
