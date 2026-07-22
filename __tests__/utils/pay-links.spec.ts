import {
  extractLightningAddressUsername,
  getDonationButtonUrl,
  getLightningAddress,
  getPosUrl,
  getPrintableQrCodeUrl,
} from "@app/utils/pay-links"

describe("getPosUrl", () => {
  it("appends the address to the terminal host", () => {
    expect(getPosUrl("alice")).toBe("https://terminal.blinkbtc.com/alice")
  })
})

describe("getPrintableQrCodeUrl", () => {
  it("appends /print to the terminal path for the address", () => {
    expect(getPrintableQrCodeUrl("alice")).toBe(
      "https://terminal.blinkbtc.com/alice/print",
    )
  })
})

describe("getDonationButtonUrl", () => {
  it("appends the address to the donation button host", () => {
    expect(getDonationButtonUrl("alice")).toBe("https://donation-button.blink.sv/alice")
  })
})

describe("username encoding", () => {
  it("leaves a well-formed username untouched", () => {
    expect(getPosUrl("alice_01")).toBe("https://terminal.blinkbtc.com/alice_01")
  })

  // A username is validated to [0-9a-z_] before registration, but the value we
  // interpolate comes back from the server or the SDK, so it is encoded rather
  // than trusted: these must stay inside the path segment we built for them.
  it("keeps a traversal attempt inside its own path segment", () => {
    expect(getPosUrl("../../evil")).toBe("https://terminal.blinkbtc.com/..%2F..%2Fevil")
  })

  it("does not let a username start a query string", () => {
    expect(getPosUrl("alice?next=evil")).toBe(
      "https://terminal.blinkbtc.com/alice%3Fnext%3Devil",
    )
  })

  it("does not let a username start a fragment", () => {
    expect(getPrintableQrCodeUrl("alice#frag")).toBe(
      "https://terminal.blinkbtc.com/alice%23frag/print",
    )
  })

  it("encodes the donation button address too", () => {
    expect(getDonationButtonUrl("../../evil")).toBe(
      "https://donation-button.blink.sv/..%2F..%2Fevil",
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
