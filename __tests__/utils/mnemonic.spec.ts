import { normalizeMnemonic } from "@app/utils/mnemonic"

describe("normalizeMnemonic", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeMnemonic("  alpha beta gamma  ")).toBe("alpha beta gamma")
  })

  it("collapses runs of internal whitespace to a single space", () => {
    expect(normalizeMnemonic("alpha    beta\t\tgamma")).toBe("alpha beta gamma")
  })

  it("collapses mixed whitespace (tabs, newlines, multiple spaces)", () => {
    expect(normalizeMnemonic("  alpha\tbeta\n\ngamma   delta\r\nepsilon  ")).toBe(
      "alpha beta gamma delta epsilon",
    )
  })

  it("preserves a single space between words", () => {
    expect(normalizeMnemonic("alpha beta")).toBe("alpha beta")
  })

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeMnemonic("   \t\n  ")).toBe("")
  })

  it("returns the same string when already normalized", () => {
    expect(normalizeMnemonic("alpha beta gamma")).toBe("alpha beta gamma")
  })
})
