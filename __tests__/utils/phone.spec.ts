import { isPhoneNumber } from "../../app/utils/phone"

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
