import {
  directionsUrl,
  hostOf,
  isWebUrl,
  merchantUrl,
  socialUrl,
  withScheme,
} from "@app/btcmap/urls"
import { BtcMapPlaceDetails } from "@app/btcmap/types"

const details = (overrides: Partial<BtcMapPlaceDetails> = {}): BtcMapPlaceDetails => ({
  id: 42,
  acceptsLightning: false,
  acceptsOnchain: false,
  acceptsContactless: false,
  ...overrides,
})

describe("hostOf", () => {
  it("reduces a URL to the host btcmap.org would show", () => {
    expect(hostOf("https://www.example.com/menu?a=1")).toBe("example.com")
    expect(hostOf("example.com")).toBe("example.com")
  })
})

describe("withScheme", () => {
  it("adds https to a bare domain", () => {
    expect(withScheme("example.com/menu")).toBe("https://example.com/menu")
  })

  it("leaves an existing scheme alone, including ones with no authority", () => {
    // "https://mailto:a@b.c" is what a `://`-only check produces, and it is junk.
    expect(withScheme("mailto:a@b.c")).toBe("mailto:a@b.c")
    expect(withScheme("lightning:lnurl1abc")).toBe("lightning:lnurl1abc")
    expect(withScheme("bitcoin:bc1qxyz")).toBe("bitcoin:bc1qxyz")
    expect(withScheme("https://example.com")).toBe("https://example.com")
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
