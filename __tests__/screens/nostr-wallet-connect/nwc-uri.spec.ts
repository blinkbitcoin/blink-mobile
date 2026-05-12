import {
  getNwcAuthorizationLinkingUrl,
  isNwcUri,
  parseNwcUri,
} from "@app/screens/nostr-wallet-connect/nwc-uri"
import { DEFAULT_NWC_PERMISSIONS } from "@app/screens/nostr-wallet-connect/nwc-types"

const PUBKEY = "a".repeat(64)
const SECRET = "b".repeat(64)
const VALID_URI = `nostr+walletconnect://${PUBKEY}?relay=wss%3A%2F%2Frelay.blink.sv&secret=${SECRET}&lud16=Amethyst`

describe("nwc-uri", () => {
  it("detects nostr wallet connect URIs", () => {
    expect(isNwcUri(VALID_URI)).toBe(true)
    expect(isNwcUri("bitcoin:bc1qtest")).toBe(false)
  })

  it("parses a valid NWC URI", () => {
    const result = parseNwcUri(VALID_URI)

    expect(result).toEqual({
      valid: true,
      raw: VALID_URI,
      serverPubkey: PUBKEY,
      relay: "wss://relay.blink.sv",
      secret: SECRET,
      appName: "Amethyst",
      returnUrl: undefined,
      permissions: DEFAULT_NWC_PERMISSIONS,
    })
  })

  it("parses requested permissions when provided", () => {
    const result = parseNwcUri(
      `nostr+walletconnect://${PUBKEY}?relay=wss%3A%2F%2Frelay.blink.sv&secret=${SECRET}&required_commands=get_info,make_invoice,notifications:payment_received`,
    )

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.permissions).toEqual([
        "get_info",
        "make_invoice",
        "notifications:payment_received",
      ])
    }
  })

  it("parses whitespace-separated requested permissions", () => {
    const result = parseNwcUri(
      `nostr+walletconnect://${PUBKEY}?relay=wss%3A%2F%2Frelay.blink.sv&secret=${SECRET}&required_commands=get_info%20get_balance%20pay_invoice`,
    )

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.permissions).toEqual(["get_info", "get_balance", "pay_invoice"])
    }
  })

  it("returns specific validation errors", () => {
    expect(parseNwcUri("not-a-url")).toMatchObject({
      valid: false,
      error: "invalid-uri",
    })
    expect(
      parseNwcUri(`nostr+walletconnect://bad?relay=wss://relay&secret=x`),
    ).toMatchObject({
      valid: false,
      error: "invalid-pubkey",
    })
    expect(parseNwcUri(`nostr+walletconnect://${PUBKEY}?secret=${SECRET}`)).toMatchObject(
      {
        valid: false,
        error: "missing-relay",
      },
    )
    expect(
      parseNwcUri(`nostr+walletconnect://${PUBKEY}?relay=https://relay&secret=${SECRET}`),
    ).toMatchObject({
      valid: false,
      error: "invalid-relay",
    })
    expect(
      parseNwcUri(`nostr+walletconnect://${PUBKEY}?relay=wss://relay`),
    ).toMatchObject({
      valid: false,
      error: "missing-secret",
    })
    expect(
      parseNwcUri(
        `nostr+walletconnect://${PUBKEY}?relay=wss://relay&secret=${SECRET}&required_commands=get_info,unknown_method`,
      ),
    ).toMatchObject({
      valid: false,
      error: "unsupported-permissions",
    })
  })

  it("builds the internal linking URL for React Navigation", () => {
    expect(getNwcAuthorizationLinkingUrl(VALID_URI)).toBe(
      `blink://nwc-auth?uri=${encodeURIComponent(VALID_URI)}`,
    )
  })
})
