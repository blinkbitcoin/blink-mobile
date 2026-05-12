import {
  extractLightningAddressUsername,
  getLightningAddress,
  getPosUrl,
  getPrintableQrCodeUrl,
} from "@app/utils/pay-links"

describe("getPosUrl", () => {
  it("appends the address to the POS base URL", () => {
    expect(getPosUrl("https://pay.blink.sv", "alice")).toBe("https://pay.blink.sv/alice")
  })
})

describe("getPrintableQrCodeUrl", () => {
  it("appends /print to the POS path for the address", () => {
    expect(getPrintableQrCodeUrl("https://pay.blink.sv", "alice")).toBe(
      "https://pay.blink.sv/alice/print",
    )
  })
})

describe("getLightningAddress", () => {
  it("returns the address as-is when it already contains an @", () => {
    expect(getLightningAddress("blink.sv", "alice@example.com")).toBe("alice@example.com")
  })

  it("appends @hostname when the address has no @", () => {
    expect(getLightningAddress("blink.sv", "alice")).toBe("alice@blink.sv")
  })
})

describe("extractLightningAddressUsername", () => {
  it("returns the username portion before the @", () => {
    expect(extractLightningAddressUsername("alice@blink.sv")).toBe("alice")
  })

  it("returns null for null input", () => {
    expect(extractLightningAddressUsername(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(extractLightningAddressUsername(undefined)).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(extractLightningAddressUsername("")).toBeNull()
  })

  it("returns null when the input starts with @ (no username portion)", () => {
    expect(extractLightningAddressUsername("@blink.sv")).toBeNull()
  })

  it("returns the input verbatim when there is no @ separator", () => {
    expect(extractLightningAddressUsername("alice")).toBe("alice")
  })

  it("preserves the username only when multiple @ are present", () => {
    expect(extractLightningAddressUsername("alice@bob@blink.sv")).toBe("alice")
  })
})
