import { formatPinBlock } from "@app/screens/card-screen/utils/format-pin-block"

describe("formatPinBlock", () => {
  it("formats a 4-digit PIN correctly", () => {
    expect(formatPinBlock("6784")).toBe("246784FFFFFFFFFF")
  })

  it("formats another 4-digit PIN correctly", () => {
    expect(formatPinBlock("1234")).toBe("241234FFFFFFFFFF")
  })

  it("always produces a 16-character block", () => {
    expect(formatPinBlock("5829")).toHaveLength(16)
  })

  it("starts with format 2 header and length", () => {
    const block = formatPinBlock("9021")
    expect(block.startsWith("24")).toBe(true)
  })

  it("pads with F characters", () => {
    const block = formatPinBlock("0000")
    expect(block).toBe("240000FFFFFFFFFF")
  })

  it("throws for PIN shorter than 4 digits", () => {
    expect(() => formatPinBlock("123")).toThrow("PIN must be exactly 4 digits")
  })

  it("throws for PIN longer than 4 digits", () => {
    expect(() => formatPinBlock("12345")).toThrow("PIN must be exactly 4 digits")
  })

  it("throws for empty PIN", () => {
    expect(() => formatPinBlock("")).toThrow("PIN must be exactly 4 digits")
  })
})
