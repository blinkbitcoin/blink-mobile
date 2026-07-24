import {
  isPhoneNumber,
  parseValidPhoneNumber,
  sanitizePhoneNumber,
} from "../../app/utils/phone"

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

  it("returns null for lightning addresses whose local part is a valid phone number", () => {
    // https://github.com/blinkbitcoin/blink-wip/issues/917 — libphonenumber
    // extracts the phone number out of the surrounding text unless told not to,
    // so user@domain lightning addresses were misdetected as phone numbers
    expect(parseValidPhoneNumber("0777491011@bitzed.xyz", "ZM")).toBeNull()
    expect(parseValidPhoneNumber("70000000@bitzed.xyz", "SV")).toBeNull()
    expect(parseValidPhoneNumber("+256777491011@bitzed.xyz", "ZM")).toBeNull()
    expect(parseValidPhoneNumber("+50370000000@blink.sv")).toBeNull()
    // https://github.com/blinkbitcoin/blink-mobile/issues/4021 — Flash (Benin)
    // uses phone numbers as lightning address usernames; BJ is the only detected
    // country for which this local part parses as a valid phone number
    expect(parseValidPhoneNumber("2290161757483@bitcoinflash.xyz", "BJ")).toBeNull()
  })

  it("returns null for lightning addresses with alphanumeric local parts", () => {
    expect(parseValidPhoneNumber("u66474248@rurbit.mooo.com", "ZM")).toBeNull()
  })

  it("still parses phone numbers with common formatting characters", () => {
    expect(parseValidPhoneNumber("+260 777 491 011")?.number).toBe("+260777491011")
    expect(parseValidPhoneNumber("077-749-1011", "ZM")?.number).toBe("+260777491011")
    expect(parseValidPhoneNumber("(077) 749 1011", "ZM")?.number).toBe("+260777491011")
    // the bare number behind #4021's lightning address still parses
    expect(parseValidPhoneNumber("2290161757483", "BJ")?.number).toBe("+2290161757483")
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

  it("returns false for lightning addresses whose local part is a valid phone number", () => {
    expect(isPhoneNumber("+50370000000@blink.sv")).toBe(false)
    expect(isPhoneNumber("+14155552671@bitzed.xyz")).toBe(false)
  })

  it("returns false for valid phone numbers without plus sign even when format is recognized", () => {
    expect(isPhoneNumber("14155552671")).toBe(false)
  })
})

describe("sanitizePhoneNumber", () => {
  it("removes spaces from phone number", () => {
    expect(sanitizePhoneNumber("911 40745533")).toBe("91140745533")
  })

  it("removes dashes from phone number", () => {
    expect(sanitizePhoneNumber("911-40745533")).toBe("91140745533")
  })

  it("removes parentheses from phone number", () => {
    expect(sanitizePhoneNumber("(911) 40745533")).toBe("91140745533")
  })

  it("preserves + prefix for international numbers", () => {
    expect(sanitizePhoneNumber("+54 911 40745533")).toBe("+5491140745533")
  })

  it("preserves + prefix with dashes and parentheses", () => {
    expect(sanitizePhoneNumber("+54 (911) 40745533")).toBe("+5491140745533")
    expect(sanitizePhoneNumber("+54-911-40745533")).toBe("+5491140745533")
    expect(sanitizePhoneNumber("+54(911)40745533")).toBe("+5491140745533")
  })

  it("handles already clean numbers", () => {
    expect(sanitizePhoneNumber("+5491140745533")).toBe("+5491140745533")
    expect(sanitizePhoneNumber("91140745533")).toBe("91140745533")
  })

  it("trims leading and trailing spaces", () => {
    expect(sanitizePhoneNumber("  +54 911 40745533  ")).toBe("+5491140745533")
    expect(sanitizePhoneNumber("  91140745533  ")).toBe("91140745533")
  })

  it("removes duplicate + signs", () => {
    expect(sanitizePhoneNumber("++503 78662557")).toBe("+50378662557")
    expect(sanitizePhoneNumber("+503 +78662557")).toBe("+50378662557")
  })

  it("removes letters and special characters", () => {
    expect(sanitizePhoneNumber("abc123def456")).toBe("123456")
    expect(sanitizePhoneNumber("+1.555.123.4567")).toBe("+15551234567")
  })

  it("handles empty and edge cases", () => {
    expect(sanitizePhoneNumber("")).toBe("")
    expect(sanitizePhoneNumber("   ")).toBe("")
    expect(sanitizePhoneNumber("+")).toBe("+")
  })
})
