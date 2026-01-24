import { ellipsizeMiddle, normalizeString } from "@app/utils/helper"

describe("ellipsizeMiddle", () => {
  it("returns original text when it fits", () => {
    const text = "simple text"
    const result = ellipsizeMiddle(text)
    expect(result).toBe(text)
  })

  it("cuts long text with default settings", () => {
    const text = "this text is clearly longer than the default display limit used in ui"
    const result = ellipsizeMiddle(text)
    expect(result.startsWith(text.slice(0, 13))).toBe(true)
    expect(result.endsWith(text.slice(text.length - 8))).toBe(true)
    expect(result).toContain("...")
  })

  it("cuts using custom options", () => {
    const text = "custom-options-text-to-verify-middle-ellipsis"
    const result = ellipsizeMiddle(text, {
      maxLength: 25,
      maxResultLeft: 7,
      maxResultRight: 5,
    })
    expect(result).toBe(text.slice(0, 7) + "..." + text.slice(text.length - 5))
  })

  it("keeps current destination style (50, 13, 8)", () => {
    const text = "lightning-invoice-for-some-user-to-pay-a-small-amount-123456"
    const result = ellipsizeMiddle(text, {
      maxLength: 50,
      maxResultLeft: 13,
      maxResultRight: 8,
    })
    expect(result.startsWith(text.slice(0, 13))).toBe(true)
    expect(result.endsWith(text.slice(text.length - 8))).toBe(true)
  })
})

describe("normalizeString", () => {
  it("trims whitespace and converts to lowercase", () => {
    expect(normalizeString("  Hello World  ")).toBe("hello world")
  })

  it("handles uppercase strings", () => {
    expect(normalizeString("UPPERCASE")).toBe("uppercase")
  })

  it("returns empty string for undefined", () => {
    expect(normalizeString(undefined)).toBe("")
  })

  it("returns empty string for empty input", () => {
    expect(normalizeString("")).toBe("")
  })

  it("handles strings with only whitespace", () => {
    expect(normalizeString("   ")).toBe("")
  })
})
