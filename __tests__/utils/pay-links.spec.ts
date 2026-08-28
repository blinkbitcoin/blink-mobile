import {
  canonicalizeOwnLightningAddress,
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

  it("passes the display currency to the terminal", () => {
    expect(getPosUrl("alice", "EUR")).toBe(
      "https://terminal.blinkbtc.com/alice?display=EUR",
    )
  })

  it("omits the query string when no currency is known", () => {
    expect(getPosUrl("alice", "")).toBe("https://terminal.blinkbtc.com/alice")
    expect(getPosUrl("alice", undefined)).toBe("https://terminal.blinkbtc.com/alice")
  })

  it("does not let a currency append another parameter", () => {
    expect(getPosUrl("alice", "EU R&amount=1")).toBe(
      "https://terminal.blinkbtc.com/alice?display=EU%20R%26amount%3D1",
    )
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

describe("canonicalizeOwnLightningAddress", () => {
  const ownDomains = ["blink.sv", "pay.blink.sv", "pay.bbw.sv"]
  const canonicalize = (lightningAddress: string, lnAddressHostname = "blink.sv") =>
    canonicalizeOwnLightningAddress({
      lightningAddress,
      ownDomains,
      lnAddressHostname,
    })

  it("restates one of our own hosts with the canonical hostname", () => {
    expect(canonicalize("alice@pay.blink.sv")).toBe("alice@blink.sv")
  })

  it("restates the legacy bitcoin beach host too", () => {
    expect(canonicalize("alice@pay.bbw.sv")).toBe("alice@blink.sv")
  })

  it("leaves an address already on the canonical hostname untouched", () => {
    expect(canonicalize("alice@blink.sv")).toBe("alice@blink.sv")
  })

  it("matches our hosts regardless of case", () => {
    expect(canonicalize("alice@PAY.Blink.SV")).toBe("alice@blink.sv")
  })

  it("leaves an address served by anyone else exactly as declared", () => {
    expect(canonicalize("alice@example.com")).toBe("alice@example.com")
  })

  it("leaves a host that merely ends with one of ours untouched", () => {
    expect(canonicalize("alice@evil-pay.blink.sv.attacker.com")).toBe(
      "alice@evil-pay.blink.sv.attacker.com",
    )
  })

  it("leaves a value that is not an address untouched", () => {
    expect(canonicalize("alice")).toBe("alice")
  })

  it("leaves a malformed address carrying several @ untouched", () => {
    expect(canonicalize("alice@bob@pay.blink.sv")).toBe("alice@bob@pay.blink.sv")
  })

  it("leaves an address with no username untouched", () => {
    expect(canonicalize("@pay.blink.sv")).toBe("@pay.blink.sv")
  })

  it("returns the address unchanged when no canonical hostname is known", () => {
    expect(
      canonicalizeOwnLightningAddress({
        lightningAddress: "alice@pay.blink.sv",
        ownDomains,
        lnAddressHostname: undefined,
      }),
    ).toBe("alice@pay.blink.sv")
  })

  it("returns the address unchanged when no host is ours", () => {
    expect(
      canonicalizeOwnLightningAddress({
        lightningAddress: "alice@pay.blink.sv",
        ownDomains: [],
        lnAddressHostname: "blink.sv",
      }),
    ).toBe("alice@pay.blink.sv")
  })
})
