import {
  ellipsizeMiddle,
  formatCardDisplayNumber,
  maskDigits,
  maskString,
  normalizeString,
} from "@app/utils/helper"

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

describe("maskString", () => {
  it("masks all but the visible right characters with default pattern", () => {
    expect(maskString("abcdef", { visibleRight: 2, maskChar: "*" })).toBe("****ef")
  })

  it("returns original when visibleRight covers all matches", () => {
    expect(maskString("abc", { visibleRight: 5, maskChar: "*" })).toBe("abc")
  })

  it("respects maskPattern and leaves non-matching characters intact", () => {
    const result = maskString("AB-12-CD", {
      visibleRight: 2,
      maskChar: "X",
      maskPattern: /[A-Z]/,
    })
    expect(result).toBe("XX-12-CD")
  })

  it("handles a non-global maskPattern by applying it globally", () => {
    expect(
      maskString("abcd", { visibleRight: 1, maskChar: "*", maskPattern: /[a-z]/ }),
    ).toBe("***d")
  })

  it("masks everything when visibleRight is zero", () => {
    expect(maskString("123", { visibleRight: 0, maskChar: "#" })).toBe("###")
  })
})

describe("maskDigits", () => {
  it("masks only digits and keeps separators", () => {
    const result = maskDigits("1234-5678-90", { visibleRight: 4, maskChar: "*" })
    expect(result).toBe("****-**78-90")
  })

  it("returns original when there are no digits", () => {
    expect(maskDigits("abcd-ef", { visibleRight: 2, maskChar: "*" })).toBe("abcd-ef")
  })

  it("uses the provided maskChar", () => {
    expect(maskDigits("9999", { visibleRight: 1, maskChar: "X" })).toBe("XXX9")
  })
})

describe("formatCardDisplayNumber", () => {
  it("masks all but last four when showDetails is false", () => {
    expect(formatCardDisplayNumber("4242", false)).toBe("•••• •••• •••• 4242")
  })

  it("pads and shows all digits when showDetails is true", () => {
    expect(formatCardDisplayNumber("4242", true)).toBe("•••• •••• •••• 4242")
  })

  it("shows full 16-digit number when showDetails is true", () => {
    expect(formatCardDisplayNumber("4111111111111111", true)).toBe("4111 1111 1111 1111")
  })

  it("masks full 16-digit number when showDetails is false", () => {
    expect(formatCardDisplayNumber("4111111111111111", false)).toBe("•••• •••• •••• 1111")
  })

  it("strips spaces before processing", () => {
    expect(formatCardDisplayNumber("4111 1111 1111 1111", false)).toBe(
      "•••• •••• •••• 1111",
    )
  })

  it("handles empty string", () => {
    expect(formatCardDisplayNumber("", false)).toBe("•••• •••• •••• ••••")
  })

  it("handles empty string with showDetails true", () => {
    expect(formatCardDisplayNumber("", true)).toBe("•••• •••• •••• ••••")
  })

  it("respects custom totalDigits and groupSize", () => {
    expect(formatCardDisplayNumber("1234", true, { totalDigits: 8, groupSize: 4 })).toBe(
      "•••• 1234",
    )
  })

  it("respects custom visibleDigits", () => {
    expect(formatCardDisplayNumber("123456", false, { visibleDigits: 2 })).toBe(
      "•••• •••• •••• ••56",
    )
  })
})
