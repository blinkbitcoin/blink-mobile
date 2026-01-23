import { isPhoneNumber, parseValidPhoneNumber } from "../../app/utils/phone"

describe("parseValidPhoneNumber", () => {
  it("returns parsed phone for valid international number", () => {
    const result = parseValidPhoneNumber("+14155552671")
    expect(result).not.toBeNull()
    expect(result?.isValid()).toBe(true)
    expect(result?.country).toBe("US")
  })

  it("returns parsed phone for valid number with country code", () => {
    const result = parseValidPhoneNumber("7400123456", "GB")
    expect(result).not.toBeNull()
    expect(result?.isValid()).toBe(true)
    expect(result?.country).toBe("GB")
  })

  it("returns null for invalid phone number", () => {
    expect(parseValidPhoneNumber("invalid")).toBeNull()
    expect(parseValidPhoneNumber("123")).toBeNull()
    expect(parseValidPhoneNumber("")).toBeNull()
  })

  it("returns null for invalid country code combination", () => {
    expect(parseValidPhoneNumber("123", "US")).toBeNull()
  })
})

describe("isPhoneNumber", () => {
  it("returns true for valid international phone numbers", () => {
    expect(isPhoneNumber("+14155552671")).toBe(true)
    expect(isPhoneNumber("+447400123456")).toBe(true)
    expect(isPhoneNumber("+50370123456")).toBe(true)
  })

  it("returns false for invalid phone numbers", () => {
    expect(isPhoneNumber("invalid")).toBe(false)
    expect(isPhoneNumber("123")).toBe(false)
    expect(isPhoneNumber("")).toBe(false)
  })

  it("returns false for usernames that look like numbers", () => {
    expect(isPhoneNumber("user123")).toBe(false)
    expect(isPhoneNumber("test@blink.sv")).toBe(false)
  })

  it("returns true for valid phone numbers without plus sign when format is recognized", () => {
    expect(isPhoneNumber("14155552671")).toBe(false)
  })
})
