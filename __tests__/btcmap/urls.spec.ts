import {
  directionsUrl,
  hostOf,
  isWebUrl,
  mailtoUrl,
  merchantUrl,
  paymentUri,
  socialUrl,
  telUrl,
  webUrl,
} from "@app/btcmap/urls"
import { BtcMapPlaceDetails } from "@app/btcmap/types"

const details = (overrides: Partial<BtcMapPlaceDetails> = {}): BtcMapPlaceDetails => ({
  id: 42,
  ...overrides,
})

describe("hostOf", () => {
  it("reduces a URL to the host btcmap.org would show", () => {
    expect(hostOf("https://www.example.com/menu?a=1")).toBe("example.com")
    expect(hostOf("example.com")).toBe("example.com")
  })
})

describe("webUrl", () => {
  it("adds https to a bare domain", () => {
    expect(webUrl("example.com/menu")).toBe("https://example.com/menu")
    // "https://mailto:a@b.c" is what a `://`-only check produces, and it is junk.
    expect(webUrl("https://example.com")).toBe("https://example.com")
    expect(webUrl("http://example.com")).toBe("http://example.com")
  })

  // These fields are raw OSM tags: a volunteer can put a wallet scheme in a
  // merchant's "website", and this app is the registered handler for several.
  it("refuses a website that is not a web link", () => {
    expect(webUrl("bitcoin:bc1qxyz?amount=1")).toBeUndefined()
    expect(webUrl("lightning:lnurl1abc")).toBeUndefined()
    expect(webUrl("lnurlp:pay@evil.example")).toBeUndefined()
    expect(webUrl("blink:something")).toBeUndefined()
    expect(webUrl("tel:*21*15550100%23")).toBeUndefined()
    expect(webUrl("mailto:a@b.c")).toBeUndefined()
    // eslint-disable-next-line no-script-url -- the point of the test
    expect(webUrl("javascript:alert(1)")).toBeUndefined()
    expect(webUrl("  ")).toBeUndefined()
  })
})

describe("paymentUri", () => {
  it("accepts the schemes a wallet can act on", () => {
    expect(paymentUri("lightning:lnurl1abc")).toBe("lightning:lnurl1abc")
    expect(paymentUri("bitcoin:bc1qxyz")).toBe("bitcoin:bc1qxyz")
    expect(paymentUri("https://pay.example/x")).toBe("https://pay.example/x")
    expect(paymentUri("mailto:pay@example.com")).toBe("mailto:pay@example.com")
  })

  it("refuses anything else, including a bare string with no scheme at all", () => {
    // eslint-disable-next-line no-script-url -- the point of the test
    expect(paymentUri("javascript:alert(1)")).toBeUndefined()
    expect(paymentUri("blink:x")).toBeUndefined()
    expect(paymentUri("pay.example/x")).toBeUndefined()
  })
})

describe("telUrl", () => {
  it("keeps a dialable number", () => {
    expect(telUrl("+1 (555) 010-0")).toBe("tel:+1 (555) 010-0")
  })

  it("refuses what would leave an MMI sequence sitting in the dialer", () => {
    // "*21*<number>#" is unconditional call forwarding.
    expect(telUrl("*21*15550100#")).toBeUndefined()
    expect(telUrl("#31#15550100")).toBeUndefined()
    expect(telUrl("nonsense")).toBeUndefined()
  })
})

describe("mailtoUrl", () => {
  it("keeps a plain address", () => {
    expect(mailtoUrl("hi@example.com")).toBe("mailto:hi@example.com")
  })

  it("refuses one carrying mail headers", () => {
    // Everything after "?" becomes subject/body/bcc.
    expect(mailtoUrl("hi@example.com?bcc=someone@example.net")).toBeUndefined()
  })
})

describe("socialUrl", () => {
  it("treats a bare handle as a username on the platform's domain", () => {
    expect(socialUrl("instagram.com", "@satoshi")).toBe("https://instagram.com/satoshi")
    expect(socialUrl("x.com", "satoshi")).toBe("https://x.com/satoshi")
  })

  it("escapes a handle that would otherwise change the path", () => {
    expect(socialUrl("x.com", "a/../b")).toBe("https://x.com/a%2F..%2Fb")
  })

  it("passes through anything that already carries a host or scheme", () => {
    expect(socialUrl("x.com", "https://x.com/satoshi")).toBe("https://x.com/satoshi")
    expect(socialUrl("x.com", "x.com/satoshi")).toBe("https://x.com/satoshi")
  })

  it("refuses a social value carrying a non-web scheme", () => {
    expect(socialUrl("x.com", "bitcoin:bc1qxyz")).toBeUndefined()
    // eslint-disable-next-line no-script-url -- the point of the test
    expect(socialUrl("x.com", "javascript:alert(1)")).toBeUndefined()
    expect(socialUrl("x.com", "  ")).toBeUndefined()
  })
})

describe("merchantUrl", () => {
  it("prefers the OSM id btcmap.org uses in its own URLs", () => {
    expect(merchantUrl(details({ osmId: "node:12607455734" }), 42)).toBe(
      "https://btcmap.org/merchant/node:12607455734",
    )
  })

  it("falls back to the numeric id before the details have loaded", () => {
    expect(merchantUrl(null, 42)).toBe("https://btcmap.org/merchant/42")
  })
})

describe("directionsUrl", () => {
  const place = { latitude: 51.5072, longitude: -0.1276 }

  it("labels the pin with the merchant's name", () => {
    expect(directionsUrl(place, "Satoshi Coffee", "ios")).toBe(
      "maps:0,0?q=Satoshi%20Coffee@51.5072,-0.1276",
    )
    expect(directionsUrl(place, "Satoshi Coffee", "android")).toBe(
      "geo:51.5072,-0.1276?q=51.5072,-0.1276(Satoshi%20Coffee)",
    )
  })

  it("drops to a bare coordinate when there is no name", () => {
    // An empty label makes both platforms search for the literal string.
    expect(directionsUrl(place, undefined, "ios")).toBe("maps:0,0?ll=51.5072,-0.1276")
    expect(directionsUrl(place, undefined, "android")).toBe(
      "geo:51.5072,-0.1276?q=51.5072,-0.1276",
    )
  })
})

describe("isWebUrl", () => {
  it("separates browsable links from schemes the OS must handle", () => {
    expect(isWebUrl("https://example.com")).toBe(true)
    expect(isWebUrl("http://example.com")).toBe(true)
    expect(isWebUrl("tel:+15550100")).toBe(false)
    expect(isWebUrl("geo:1,2?q=1,2")).toBe(false)
    expect(isWebUrl("lightning:lnurl1abc")).toBe(false)
    expect(isWebUrl("mailto:a@b.c")).toBe(false)
  })
})
